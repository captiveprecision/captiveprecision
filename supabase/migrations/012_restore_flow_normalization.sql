create or replace function public.planner_workspace_root_can_access(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_access text default 'write'
)
returns boolean
language sql
stable
as $$
  with root as (
    select *
    from public.workspace_roots
    where id = p_workspace_root_id
  )
  select case
    when public.planner_actor_is_admin(p_actor_profile_id) then true
    when exists (
      select 1
      from root r
      where r.scope_type = 'coach'
        and r.owner_profile_id = p_actor_profile_id
    ) then true
    else exists (
      select 1
      from root r
      where r.scope_type = 'gym'
        and (
          r.owner_profile_id = p_actor_profile_id
          or exists (
            select 1
            from public.gym_coach_licenses gcl
            where gcl.gym_id = r.gym_id
              and gcl.coach_profile_id = p_actor_profile_id
              and gcl.status = 'active'
          )
        )
    )
  end;
$$;

create or replace function public.planner_restore_related_entities(
  p_entity_type text,
  p_entity_id text,
  p_workspace_root_id uuid,
  p_actor_profile_id uuid,
  p_change_set_id uuid,
  p_delete_change_set_id uuid,
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
  if p_entity_type not in ('athlete', 'team') or p_delete_change_set_id is null then
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
        and last_change_set_id = p_delete_change_set_id
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
        and last_change_set_id = p_delete_change_set_id
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
        and last_change_set_id = p_delete_change_set_id
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
        and last_change_set_id = p_delete_change_set_id
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
        and last_change_set_id = p_delete_change_set_id
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
        and last_change_set_id = p_delete_change_set_id
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
  latest_delete_row record;
  restored_snapshot jsonb;
  restored_lock_version integer;
  change_set_id uuid;
  new_version_id uuid;
  current_table text;
  restored_relations jsonb := '{}'::jsonb;
  delete_occurred_at timestamptz;
  delete_expires_at timestamptz;
  has_later_restore boolean := false;
begin
  if p_entity_type not in ('athlete', 'team') then
    raise exception 'RESTORE_NOT_AVAILABLE';
  end if;

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

  if version_row.change_type <> 'delete' then
    raise exception 'RESTORE_NOT_AVAILABLE';
  end if;

  select *
  into latest_delete_row
  from public.workspace_entity_versions
  where workspace_root_id = p_workspace_root_id
    and entity_type = version_row.entity_type
    and entity_id = version_row.entity_id
    and change_type = 'delete'
  order by version_number desc, created_at desc
  limit 1;

  if latest_delete_row.id is null or latest_delete_row.id <> version_row.id then
    raise exception 'RESTORE_NOT_AVAILABLE';
  end if;

  select exists (
    select 1
    from public.workspace_entity_versions later
    where later.workspace_root_id = p_workspace_root_id
      and later.entity_type = version_row.entity_type
      and later.entity_id = version_row.entity_id
      and later.change_type = 'restore'
      and later.version_number > version_row.version_number
  )
  into has_later_restore;

  if has_later_restore then
    raise exception 'RESTORE_NOT_AVAILABLE';
  end if;

  delete_occurred_at := coalesce((version_row.snapshot ->> 'deleted_at')::timestamptz, version_row.created_at);
  delete_expires_at := delete_occurred_at + interval '90 days';

  if delete_expires_at <= now() then
    raise exception 'RESTORE_EXPIRED';
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
    version_row.change_set_id,
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

drop function if exists public.planner_restore_related_entities(text, text, uuid, uuid, uuid, uuid);
