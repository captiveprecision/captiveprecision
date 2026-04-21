create or replace function public.planner_soft_delete_athlete(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_athlete_id uuid,
  p_expected_lock_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_athlete public.athletes;
  updated_athlete public.athletes;
  change_set_id uuid;
  version_id uuid;
  assignment_row public.athlete_team_assignments;
  evaluation_row public.planner_evaluations;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into current_athlete
  from public.athletes
  where id = p_athlete_id
    and workspace_root_id = p_workspace_root_id
    and deleted_at is null;

  if current_athlete.id is null then
    raise exception 'ATHLETE_NOT_FOUND';
  end if;

  if p_expected_lock_version is not null and current_athlete.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  perform public.planner_create_workspace_backup(
    p_workspace_root_id,
    'pre-destructive',
    p_actor_profile_id,
    jsonb_build_object('entityType', 'athlete', 'entityId', p_athlete_id)
  );

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'athlete-delete',
    'Soft delete athlete',
    jsonb_build_object('athleteId', p_athlete_id)
  );

  update public.athletes
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = current_athlete.lock_version + 1
  where id = p_athlete_id
  returning *
  into updated_athlete;

  for assignment_row in
    select *
    from public.athlete_team_assignments
    where workspace_root_id = p_workspace_root_id
      and athlete_id = p_athlete_id
      and deleted_at is null
  loop
    update public.athlete_team_assignments
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = assignment_row.lock_version + 1
    where id = assignment_row.id
    returning *
    into assignment_row;

    perform public.planner_record_entity_version(
      'assignment',
      assignment_row.id::text,
      p_workspace_root_id,
      assignment_row.lock_version,
      'delete',
      row_to_json(assignment_row)::jsonb,
      p_actor_profile_id,
      change_set_id
    );
  end loop;

  for evaluation_row in
    select *
    from public.planner_evaluations
    where workspace_root_id = p_workspace_root_id
      and athlete_id = p_athlete_id
      and deleted_at is null
  loop
    update public.planner_evaluations
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = evaluation_row.lock_version + 1
    where id = evaluation_row.id
    returning *
    into evaluation_row;

    perform public.planner_record_entity_version(
      'evaluation',
      evaluation_row.id::text,
      p_workspace_root_id,
      evaluation_row.lock_version,
      'delete',
      row_to_json(evaluation_row)::jsonb,
      p_actor_profile_id,
      change_set_id
    );
  end loop;

  version_id := public.planner_record_entity_version(
    'athlete',
    updated_athlete.id::text,
    p_workspace_root_id,
    updated_athlete.lock_version,
    'delete',
    row_to_json(updated_athlete)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', row_to_json(updated_athlete)::jsonb,
    'lockVersion', updated_athlete.lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', updated_athlete.lock_version,
    'versionId', version_id
  );
end;
$$;

create or replace function public.planner_restore_related_entities(
  p_entity_type text,
  p_entity_id text,
  p_workspace_root_id uuid,
  p_actor_profile_id uuid,
  p_change_set_id uuid,
  p_restored_from_version_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_uuid uuid;
  assignment_row public.athlete_team_assignments;
  evaluation_row public.planner_evaluations;
  skill_plan_row public.team_skill_plans;
  routine_plan_row public.team_routine_plans;
  season_plan_row public.team_season_plans;
  restored_assignment_count integer := 0;
  restored_evaluation_count integer := 0;
  restored_skill_plan_count integer := 0;
  restored_routine_plan_count integer := 0;
  restored_season_plan_count integer := 0;
begin
  if p_entity_type not in ('athlete', 'team') then
    return '{}'::jsonb;
  end if;

  entity_uuid := p_entity_id::uuid;

  if p_entity_type = 'athlete' then
    for assignment_row in
      select *
      from public.athlete_team_assignments
      where workspace_root_id = p_workspace_root_id
        and athlete_id = entity_uuid
        and deleted_at is not null
    loop
      update public.athlete_team_assignments
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = assignment_row.lock_version + 1
      where id = assignment_row.id
      returning *
      into assignment_row;

      perform public.planner_record_entity_version(
        'assignment',
        assignment_row.id::text,
        p_workspace_root_id,
        assignment_row.lock_version,
        'restore',
        row_to_json(assignment_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_assignment_count := restored_assignment_count + 1;
    end loop;

    for evaluation_row in
      select *
      from public.planner_evaluations
      where workspace_root_id = p_workspace_root_id
        and athlete_id = entity_uuid
        and deleted_at is not null
    loop
      update public.planner_evaluations
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = evaluation_row.lock_version + 1
      where id = evaluation_row.id
      returning *
      into evaluation_row;

      perform public.planner_record_entity_version(
        'evaluation',
        evaluation_row.id::text,
        p_workspace_root_id,
        evaluation_row.lock_version,
        'restore',
        row_to_json(evaluation_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_evaluation_count := restored_evaluation_count + 1;
    end loop;
  elsif p_entity_type = 'team' then
    for assignment_row in
      select *
      from public.athlete_team_assignments
      where workspace_root_id = p_workspace_root_id
        and team_id = entity_uuid
        and deleted_at is not null
    loop
      update public.athlete_team_assignments
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = assignment_row.lock_version + 1
      where id = assignment_row.id
      returning *
      into assignment_row;

      perform public.planner_record_entity_version(
        'assignment',
        assignment_row.id::text,
        p_workspace_root_id,
        assignment_row.lock_version,
        'restore',
        row_to_json(assignment_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_assignment_count := restored_assignment_count + 1;
    end loop;

    for skill_plan_row in
      select *
      from public.team_skill_plans
      where workspace_root_id = p_workspace_root_id
        and team_id = entity_uuid
        and deleted_at is not null
    loop
      update public.team_skill_plans
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = skill_plan_row.lock_version + 1
      where id = skill_plan_row.id
      returning *
      into skill_plan_row;

      perform public.planner_record_entity_version(
        'skill-plan',
        skill_plan_row.id::text,
        p_workspace_root_id,
        skill_plan_row.lock_version,
        'restore',
        row_to_json(skill_plan_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_skill_plan_count := restored_skill_plan_count + 1;
    end loop;

    for routine_plan_row in
      select *
      from public.team_routine_plans
      where workspace_root_id = p_workspace_root_id
        and team_id = entity_uuid
        and deleted_at is not null
    loop
      update public.team_routine_plans
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = routine_plan_row.lock_version + 1
      where id = routine_plan_row.id
      returning *
      into routine_plan_row;

      perform public.planner_record_entity_version(
        'routine-plan',
        routine_plan_row.id::text,
        p_workspace_root_id,
        routine_plan_row.lock_version,
        'restore',
        row_to_json(routine_plan_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_routine_plan_count := restored_routine_plan_count + 1;
    end loop;

    for season_plan_row in
      select *
      from public.team_season_plans
      where workspace_root_id = p_workspace_root_id
        and team_id = entity_uuid
        and deleted_at is not null
    loop
      update public.team_season_plans
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = season_plan_row.lock_version + 1
      where id = season_plan_row.id
      returning *
      into season_plan_row;

      perform public.planner_record_entity_version(
        'season-plan',
        season_plan_row.id::text,
        p_workspace_root_id,
        season_plan_row.lock_version,
        'restore',
        row_to_json(season_plan_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_season_plan_count := restored_season_plan_count + 1;
    end loop;
  end if;

  return jsonb_build_object(
    'assignments', restored_assignment_count,
    'evaluations', restored_evaluation_count,
    'skillPlans', restored_skill_plan_count,
    'routinePlans', restored_routine_plan_count,
    'seasonPlans', restored_season_plan_count
  );
end;
$$;

create or replace function public.planner_soft_delete_team(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_expected_lock_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_team public.teams;
  updated_team public.teams;
  change_set_id uuid;
  version_id uuid;
  assignment_row public.athlete_team_assignments;
  skill_plan_row public.team_skill_plans;
  routine_plan_row public.team_routine_plans;
  season_plan_row public.team_season_plans;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into current_team
  from public.teams
  where id = p_team_id
    and workspace_root_id = p_workspace_root_id
    and deleted_at is null;

  if current_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if p_expected_lock_version is not null and current_team.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  perform public.planner_create_workspace_backup(
    p_workspace_root_id,
    'pre-destructive',
    p_actor_profile_id,
    jsonb_build_object('entityType', 'team', 'entityId', p_team_id)
  );

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'team-delete',
    'Soft delete team',
    jsonb_build_object('teamId', p_team_id)
  );

  update public.teams
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = current_team.lock_version + 1
  where id = p_team_id
  returning *
  into updated_team;

  for assignment_row in
    select *
    from public.athlete_team_assignments
    where team_id = p_team_id
      and workspace_root_id = p_workspace_root_id
      and deleted_at is null
  loop
    update public.athlete_team_assignments
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = assignment_row.lock_version + 1
    where id = assignment_row.id
    returning *
    into assignment_row;

    perform public.planner_record_entity_version(
      'assignment',
      assignment_row.id::text,
      p_workspace_root_id,
      assignment_row.lock_version,
      'delete',
      row_to_json(assignment_row)::jsonb,
      p_actor_profile_id,
      change_set_id
    );
  end loop;

  for skill_plan_row in
    select *
    from public.team_skill_plans
    where team_id = p_team_id
      and workspace_root_id = p_workspace_root_id
      and deleted_at is null
  loop
    update public.team_skill_plans
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = skill_plan_row.lock_version + 1
    where id = skill_plan_row.id
    returning *
    into skill_plan_row;

    perform public.planner_record_entity_version(
      'skill-plan',
      skill_plan_row.id::text,
      p_workspace_root_id,
      skill_plan_row.lock_version,
      'delete',
      row_to_json(skill_plan_row)::jsonb,
      p_actor_profile_id,
      change_set_id
    );
  end loop;

  for routine_plan_row in
    select *
    from public.team_routine_plans
    where team_id = p_team_id
      and workspace_root_id = p_workspace_root_id
      and deleted_at is null
  loop
    update public.team_routine_plans
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = routine_plan_row.lock_version + 1
    where id = routine_plan_row.id
    returning *
    into routine_plan_row;

    perform public.planner_record_entity_version(
      'routine-plan',
      routine_plan_row.id::text,
      p_workspace_root_id,
      routine_plan_row.lock_version,
      'delete',
      row_to_json(routine_plan_row)::jsonb,
      p_actor_profile_id,
      change_set_id
    );
  end loop;

  for season_plan_row in
    select *
    from public.team_season_plans
    where team_id = p_team_id
      and workspace_root_id = p_workspace_root_id
      and deleted_at is null
  loop
    update public.team_season_plans
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = season_plan_row.lock_version + 1
    where id = season_plan_row.id
    returning *
    into season_plan_row;

    perform public.planner_record_entity_version(
      'season-plan',
      season_plan_row.id::text,
      p_workspace_root_id,
      season_plan_row.lock_version,
      'delete',
      row_to_json(season_plan_row)::jsonb,
      p_actor_profile_id,
      change_set_id
    );
  end loop;

  version_id := public.planner_record_entity_version(
    'team',
    updated_team.id::text,
    p_workspace_root_id,
    updated_team.lock_version,
    'delete',
    row_to_json(updated_team)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', row_to_json(updated_team)::jsonb,
    'lockVersion', updated_team.lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', updated_team.lock_version,
    'versionId', version_id
  );
end;
$$;

create or replace function public.planner_command_entity_restore(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_entity_type text,
  p_version_id uuid,
  p_expected_lock_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  version_row record;
  restored_snapshot jsonb;
  restored_lock_version integer;
  change_set_id uuid;
  new_version_id uuid;
  current_table text;
  restored_relations jsonb := '{}'::jsonb;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'restore') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into version_row
  from public.workspace_entity_versions
  where id = p_version_id
    and entity_type = p_entity_type
    and workspace_root_id = p_workspace_root_id;

  if version_row.id is null then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  current_table := public.planner_entity_current_table(p_entity_type);

  if p_expected_lock_version is not null then
    execute format('select lock_version from public.%I where id::text = $1', current_table)
    into restored_lock_version
    using version_row.entity_id;

    if restored_lock_version is not null and restored_lock_version <> p_expected_lock_version then
      perform public.planner_raise_conflict('PLANNER_CONFLICT');
    end if;
  end if;

  perform public.planner_create_workspace_backup(
    p_workspace_root_id,
    'pre-destructive',
    p_actor_profile_id,
    jsonb_build_object('entityType', p_entity_type, 'versionId', p_version_id)
  );

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'entity-restore',
    'Restore entity version',
    jsonb_build_object('entityType', p_entity_type, 'versionId', p_version_id)
  );

  restored_snapshot := public.planner_restore_snapshot_row(
    p_entity_type,
    version_row.snapshot,
    p_workspace_root_id,
    p_actor_profile_id,
    change_set_id,
    p_version_id
  );

  restored_lock_version := coalesce((restored_snapshot ->> 'lock_version')::integer, 1);
  restored_relations := public.planner_restore_related_entities(
    p_entity_type,
    version_row.entity_id,
    p_workspace_root_id,
    p_actor_profile_id,
    change_set_id,
    p_version_id
  );

  new_version_id := public.planner_record_entity_version(
    p_entity_type,
    version_row.entity_id,
    p_workspace_root_id,
    restored_lock_version,
    'restore',
    restored_snapshot,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', restored_snapshot,
    'lockVersion', restored_lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', restored_lock_version,
    'versionId', new_version_id,
    'restoredRelations', restored_relations
  );
end;
$$;

create or replace function public.planner_list_workspace_trash(
  p_workspace_root_id uuid,
  p_search text default null,
  p_entity_type text default null,
  p_limit integer default 100
)
returns table (
  entity_type text,
  entity_id text,
  version_id uuid,
  name text,
  secondary_label text,
  deleted_at timestamptz,
  deleted_by_profile_id uuid,
  deleted_by_name text,
  expires_at timestamptz,
  restore_available boolean,
  snapshot jsonb
)
language sql
security definer
set search_path = public
as $$
  with latest_delete as (
    select
      wev.*,
      row_number() over (
        partition by wev.entity_type, wev.entity_id
        order by wev.created_at desc
      ) as rn
    from public.workspace_entity_versions wev
    where wev.workspace_root_id = p_workspace_root_id
      and wev.change_type = 'delete'
      and wev.entity_type in ('athlete', 'team')
      and (p_entity_type is null or wev.entity_type = p_entity_type)
  ),
  unresolved_delete as (
    select *
    from latest_delete ld
    where ld.rn = 1
      and not exists (
        select 1
        from public.workspace_entity_versions later
        where later.workspace_root_id = ld.workspace_root_id
          and later.entity_type = ld.entity_type
          and later.entity_id = ld.entity_id
          and later.created_at > ld.created_at
          and later.change_type = 'restore'
      )
  ),
  decorated as (
    select
      ud.entity_type,
      ud.entity_id,
      ud.id as version_id,
      case
        when ud.entity_type = 'athlete' then trim(concat(coalesce(ud.snapshot ->> 'first_name', ''), ' ', coalesce(ud.snapshot ->> 'last_name', '')))
        else coalesce(ud.snapshot ->> 'name', '')
      end as computed_name,
      case
        when ud.entity_type = 'athlete' then coalesce(nullif(ud.snapshot ->> 'registration_number', ''), nullif(ud.snapshot #>> '{metadata,registrationNumber}', ''))
        else concat_ws(' / ', nullif(ud.snapshot ->> 'division', ''), nullif(ud.snapshot #>> '{metadata,teamLevel}', ''), nullif(ud.snapshot #>> '{metadata,ageCategory}', ''))
      end as computed_secondary_label,
      coalesce((ud.snapshot ->> 'deleted_at')::timestamptz, ud.created_at) as computed_deleted_at,
      coalesce((ud.snapshot ->> 'deleted_by_profile_id')::uuid, ud.changed_by_profile_id) as computed_deleted_by_profile_id,
      p.display_name as computed_deleted_by_name,
      coalesce((ud.snapshot ->> 'deleted_at')::timestamptz, ud.created_at) + interval '90 days' as computed_expires_at,
      ud.snapshot
    from unresolved_delete ud
    left join public.profiles p
      on p.id = coalesce((ud.snapshot ->> 'deleted_by_profile_id')::uuid, ud.changed_by_profile_id)
  )
  select
    d.entity_type,
    d.entity_id,
    d.version_id,
    coalesce(nullif(d.computed_name, ''), 'Untitled') as name,
    coalesce(d.computed_secondary_label, '') as secondary_label,
    d.computed_deleted_at as deleted_at,
    d.computed_deleted_by_profile_id as deleted_by_profile_id,
    d.computed_deleted_by_name as deleted_by_name,
    d.computed_expires_at as expires_at,
    d.computed_expires_at > timezone('utc'::text, now()) as restore_available,
    d.snapshot
  from decorated d
  where d.computed_expires_at > timezone('utc'::text, now())
    and (
      p_search is null
      or p_search = ''
      or (
        lower(coalesce(d.computed_name, '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(d.computed_secondary_label, '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(d.snapshot #>> '{parent_contacts,0,name}', '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(d.snapshot #>> '{parent_contacts,0,email}', '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(d.snapshot #>> '{metadata,parentContacts,0,name}', '')) like '%' || lower(p_search) || '%'
        or lower(coalesce(d.snapshot #>> '{metadata,parentContacts,0,email}', '')) like '%' || lower(p_search) || '%'
      )
    )
  order by d.computed_deleted_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;
