begin;

do $$
begin
  if to_regclass('public.planner_evaluations') is not null
    and to_regclass('public.planner_tryout_records') is null then
    execute 'alter table public.planner_evaluations rename to planner_tryout_records';
  end if;

  if to_regclass('public.planner_evaluation_versions') is not null
    and to_regclass('public.planner_tryout_record_versions') is null then
    execute 'alter table public.planner_evaluation_versions rename to planner_tryout_record_versions';
  end if;
end;
$$;

alter index if exists public.idx_planner_evaluations_project_id rename to idx_planner_tryout_records_project_id;
alter index if exists public.idx_planner_evaluations_athlete_id rename to idx_planner_tryout_records_athlete_id;
alter index if exists public.idx_planner_evaluations_occurred_at rename to idx_planner_tryout_records_occurred_at;
alter index if exists public.idx_planner_evaluations_workspace_root_active rename to idx_planner_tryout_records_workspace_root_active;
alter index if exists public.idx_evaluation_versions_root_entity_created rename to idx_tryout_record_versions_root_entity_created;

drop trigger if exists set_planner_evaluations_updated_at on public.planner_tryout_records;
drop trigger if exists set_planner_tryout_records_updated_at on public.planner_tryout_records;
create trigger set_planner_tryout_records_updated_at
  before update on public.planner_tryout_records
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.planner_tryout_records enable row level security;
alter table public.planner_tryout_record_versions enable row level security;

drop policy if exists "planner_evaluations_select_related" on public.planner_tryout_records;
drop policy if exists "planner_evaluations_insert_related" on public.planner_tryout_records;
drop policy if exists "planner_evaluations_update_related" on public.planner_tryout_records;
drop policy if exists "planner_evaluations_delete_related" on public.planner_tryout_records;
drop policy if exists "planner_tryout_records_select_related" on public.planner_tryout_records;
drop policy if exists "planner_tryout_records_insert_related" on public.planner_tryout_records;
drop policy if exists "planner_tryout_records_update_related" on public.planner_tryout_records;
drop policy if exists "planner_tryout_records_delete_related" on public.planner_tryout_records;

create policy "planner_tryout_records_select_related"
  on public.planner_tryout_records for select
  using (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_tryout_records.planner_project_id
        and (
          (pp.scope_type = 'coach' and pp.owner_profile_id = auth.uid())
          or exists (
            select 1
            from public.gyms g
            where g.id = pp.gym_id
              and g.owner_profile_id = auth.uid()
          )
        )
    )
  );

create policy "planner_tryout_records_insert_related"
  on public.planner_tryout_records for insert
  with check (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_tryout_records.planner_project_id
        and (
          (pp.scope_type = 'coach' and pp.owner_profile_id = auth.uid())
          or exists (
            select 1
            from public.gyms g
            where g.id = pp.gym_id
              and g.owner_profile_id = auth.uid()
          )
        )
    )
  );

create policy "planner_tryout_records_update_related"
  on public.planner_tryout_records for update
  using (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_tryout_records.planner_project_id
        and (
          (pp.scope_type = 'coach' and pp.owner_profile_id = auth.uid())
          or exists (
            select 1
            from public.gyms g
            where g.id = pp.gym_id
              and g.owner_profile_id = auth.uid()
          )
        )
    )
  );

create policy "planner_tryout_records_delete_related"
  on public.planner_tryout_records for delete
  using (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_tryout_records.planner_project_id
        and (
          (pp.scope_type = 'coach' and pp.owner_profile_id = auth.uid())
          or exists (
            select 1
            from public.gyms g
            where g.id = pp.gym_id
              and g.owner_profile_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "evaluation_versions_select_related" on public.planner_tryout_record_versions;
drop policy if exists "tryout_record_versions_select_related" on public.planner_tryout_record_versions;
create policy "tryout_record_versions_select_related"
  on public.planner_tryout_record_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

update public.workspace_backups
set snapshot = jsonb_set(snapshot - 'evaluations', '{tryoutRecords}', snapshot -> 'evaluations', true)
where snapshot ? 'evaluations'
  and not snapshot ? 'tryoutRecords';

update public.workspace_change_sets
set
  action = 'tryout-save',
  summary = case
    when summary = 'Save planner evaluation' then 'Save planner tryout record'
    else summary
  end,
  metadata = case
    when metadata ? 'evaluationId' then (metadata - 'evaluationId') || jsonb_build_object('tryoutRecordId', metadata ->> 'evaluationId')
    else metadata
  end
where action = 'evaluation-save';

drop function if exists public.planner_record_entity_version(text, text, uuid, integer, text, jsonb, uuid, uuid);
drop function if exists public.planner_entity_current_table(text);
drop function if exists public.planner_create_workspace_backup(uuid, text, uuid, jsonb);
drop function if exists public.planner_command_tryout_save(uuid, uuid, text, uuid, integer, timestamptz, jsonb);
drop function if exists public.planner_soft_delete_athlete(uuid, uuid, uuid, integer);
drop function if exists public.planner_restore_related_entities(text, text, uuid, uuid, uuid, uuid, uuid);
drop function if exists public.planner_command_workspace_restore(uuid, uuid, uuid);

create or replace function public.planner_record_entity_version(
  p_entity_type text,
  p_entity_id text,
  p_workspace_root_id uuid,
  p_version_number integer,
  p_change_type text,
  p_snapshot jsonb,
  p_changed_by_profile_id uuid,
  p_change_set_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_table text;
  inserted_id uuid;
begin
  version_table := case p_entity_type
    when 'athlete' then 'athlete_versions'
    when 'team' then 'team_versions'
    when 'assignment' then 'athlete_team_assignment_versions'
    when 'planner-project' then 'planner_project_versions'
    when 'tryout-record' then 'planner_tryout_record_versions'
    when 'skill-plan' then 'team_skill_plan_versions'
    when 'routine-plan' then 'team_routine_plan_versions'
    when 'season-plan' then 'team_season_plan_versions'
    else null
  end;

  if version_table is null then
    raise exception 'UNSUPPORTED_ENTITY_TYPE';
  end if;

  execute format(
    'insert into public.%I (
      entity_id,
      workspace_root_id,
      version_number,
      change_type,
      snapshot,
      changed_by_profile_id,
      change_set_id
    ) values ($1, $2, $3, $4, $5, $6, $7)
    returning id',
    version_table
  )
  into inserted_id
  using
    p_entity_id,
    p_workspace_root_id,
    p_version_number,
    p_change_type,
    coalesce(p_snapshot, '{}'::jsonb),
    p_changed_by_profile_id,
    p_change_set_id;

  return inserted_id;
end;
$$;

create or replace function public.planner_entity_current_table(
  p_entity_type text
)
returns text
language sql
immutable
as $$
  select case p_entity_type
    when 'athlete' then 'athletes'
    when 'team' then 'teams'
    when 'assignment' then 'athlete_team_assignments'
    when 'planner-project' then 'planner_projects'
    when 'tryout-record' then 'planner_tryout_records'
    when 'skill-plan' then 'team_skill_plans'
    when 'routine-plan' then 'team_routine_plans'
    when 'season-plan' then 'team_season_plans'
    else null
  end;
$$;

create or replace function public.planner_create_workspace_backup(
  p_workspace_root_id uuid,
  p_backup_type text,
  p_triggered_by_profile_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  backup_snapshot jsonb;
  backup_id uuid;
begin
  select jsonb_build_object(
    'workspaceRoot', (
      select row_to_json(wr)::jsonb
      from public.workspace_roots wr
      where wr.id = p_workspace_root_id
    ),
    'plannerProject', coalesce((
      select row_to_json(pp)::jsonb
      from public.planner_projects pp
      where pp.workspace_root_id = p_workspace_root_id
        and pp.deleted_at is null
      order by pp.updated_at desc
      limit 1
    ), '{}'::jsonb),
    'athletes', coalesce((
      select jsonb_agg(row_to_json(a)::jsonb order by a.created_at asc)
      from public.athletes a
      where a.workspace_root_id = p_workspace_root_id
        and a.deleted_at is null
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at asc)
      from public.teams t
      where t.workspace_root_id = p_workspace_root_id
        and t.deleted_at is null
    ), '[]'::jsonb),
    'teamCoaches', coalesce((
      select jsonb_agg(row_to_json(tc)::jsonb order by tc.created_at asc)
      from public.team_coaches tc
      where exists (
        select 1
        from public.teams t
        where t.id = tc.team_id
          and t.workspace_root_id = p_workspace_root_id
          and t.deleted_at is null
      )
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(row_to_json(ata)::jsonb order by ata.created_at asc)
      from public.athlete_team_assignments ata
      where ata.workspace_root_id = p_workspace_root_id
        and ata.deleted_at is null
    ), '[]'::jsonb),
    'tryoutRecords', coalesce((
      select jsonb_agg(row_to_json(ptr)::jsonb order by ptr.created_at asc)
      from public.planner_tryout_records ptr
      where ptr.workspace_root_id = p_workspace_root_id
        and ptr.deleted_at is null
    ), '[]'::jsonb),
    'skillPlans', coalesce((
      select jsonb_agg(row_to_json(sp)::jsonb order by sp.created_at asc)
      from public.team_skill_plans sp
      where sp.workspace_root_id = p_workspace_root_id
        and sp.deleted_at is null
    ), '[]'::jsonb),
    'routinePlans', coalesce((
      select jsonb_agg(row_to_json(rp)::jsonb order by rp.created_at asc)
      from public.team_routine_plans rp
      where rp.workspace_root_id = p_workspace_root_id
        and rp.deleted_at is null
    ), '[]'::jsonb),
    'seasonPlans', coalesce((
      select jsonb_agg(row_to_json(sep)::jsonb order by sep.created_at asc)
      from public.team_season_plans sep
      where sep.workspace_root_id = p_workspace_root_id
        and sep.deleted_at is null
    ), '[]'::jsonb)
  )
  into backup_snapshot;

  insert into public.workspace_backups (
    workspace_root_id,
    backup_type,
    status,
    snapshot,
    metadata,
    triggered_by_profile_id,
    expires_at
  )
  values (
    p_workspace_root_id,
    p_backup_type,
    'ready',
    coalesce(backup_snapshot, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    p_triggered_by_profile_id,
    case
      when p_backup_type = 'scheduled-nightly' then timezone('utc'::text, now()) + interval '365 days'
      else timezone('utc'::text, now()) + interval '30 days'
    end
  )
  returning id
  into backup_id;

  return backup_id;
end;
$$;

create or replace function public.planner_command_tryout_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_tryout_record_id text,
  p_athlete_id uuid,
  p_expected_lock_version integer default null,
  p_occurred_at timestamptz default null,
  p_record jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.planner_tryout_records;
  next_row public.planner_tryout_records;
  athlete_row public.athletes;
  project_row public.planner_projects;
  touched_project_row public.planner_projects;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into athlete_row
  from public.athletes
  where id = p_athlete_id
    and workspace_root_id = p_workspace_root_id
    and deleted_at is null;

  if athlete_row.id is null then
    raise exception 'ATHLETE_NOT_FOUND';
  end if;

  select *
  into current_row
  from public.planner_tryout_records
  where id = p_tryout_record_id
    and workspace_root_id = p_workspace_root_id;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  project_row := public.planner_ensure_project_row(p_workspace_root_id);

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'tryout-save',
    'Save planner tryout record',
    jsonb_build_object('tryoutRecordId', p_tryout_record_id, 'athleteId', p_athlete_id)
  );

  if current_row.id is null then
    insert into public.planner_tryout_records (
      id,
      workspace_root_id,
      planner_project_id,
      athlete_id,
      occurred_at,
      record,
      lock_version,
      last_change_set_id
    )
    values (
      p_tryout_record_id,
      p_workspace_root_id,
      project_row.id,
      p_athlete_id,
      p_occurred_at,
      coalesce(p_record, '{}'::jsonb),
      1,
      change_set_id
    )
    returning *
    into next_row;

    change_type := 'create';
  else
    update public.planner_tryout_records
    set
      athlete_id = p_athlete_id,
      occurred_at = p_occurred_at,
      record = coalesce(p_record, current_row.record),
      deleted_at = null,
      deleted_by_profile_id = null,
      restored_from_version_id = null,
      last_change_set_id = change_set_id,
      lock_version = current_row.lock_version + 1
    where id = current_row.id
    returning *
    into next_row;

    change_type := case when current_row.deleted_at is not null then 'restore' else 'update' end;
  end if;

  touched_project_row := public.planner_touch_project_activity(project_row.id, change_set_id);

  version_id := public.planner_record_entity_version(
    'tryout-record',
    next_row.id,
    p_workspace_root_id,
    next_row.lock_version,
    change_type,
    row_to_json(next_row)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', row_to_json(next_row)::jsonb,
    'lockVersion', next_row.lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', next_row.lock_version,
    'versionId', version_id,
    'projectLockVersion', touched_project_row.lock_version
  );
end;
$$;

drop function if exists public.planner_command_evaluation_save(uuid, uuid, text, uuid, integer, timestamptz, jsonb);

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
  tryout_row public.planner_tryout_records;
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

  for tryout_row in
    select *
    from public.planner_tryout_records
    where workspace_root_id = p_workspace_root_id
      and athlete_id = p_athlete_id
      and deleted_at is null
  loop
    update public.planner_tryout_records
    set
      deleted_at = timezone('utc'::text, now()),
      deleted_by_profile_id = p_actor_profile_id,
      last_change_set_id = change_set_id,
      lock_version = tryout_row.lock_version + 1
    where id = tryout_row.id
    returning *
    into tryout_row;

    perform public.planner_record_entity_version(
      'tryout-record',
      tryout_row.id::text,
      p_workspace_root_id,
      tryout_row.lock_version,
      'delete',
      row_to_json(tryout_row)::jsonb,
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
  tryout_row public.planner_tryout_records;
  skill_plan_row public.team_skill_plans;
  routine_plan_row public.team_routine_plans;
  season_plan_row public.team_season_plans;
  restored_assignment_count integer := 0;
  restored_tryout_record_count integer := 0;
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

    for tryout_row in
      select *
      from public.planner_tryout_records
      where workspace_root_id = p_workspace_root_id
        and athlete_id = entity_uuid
        and deleted_at is not null
        and last_change_set_id = p_delete_change_set_id
    loop
      update public.planner_tryout_records
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = p_restored_from_version_id,
        last_change_set_id = p_change_set_id,
        lock_version = tryout_row.lock_version + 1
      where id = tryout_row.id
      returning *
      into tryout_row;

      perform public.planner_record_entity_version(
        'tryout-record',
        tryout_row.id::text,
        p_workspace_root_id,
        tryout_row.lock_version,
        'restore',
        row_to_json(tryout_row)::jsonb,
        p_actor_profile_id,
        p_change_set_id
      );

      restored_tryout_record_count := restored_tryout_record_count + 1;
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
    'tryoutRecords', restored_tryout_record_count,
    'skillPlans', restored_skill_plan_count,
    'routinePlans', restored_routine_plan_count,
    'seasonPlans', restored_season_plan_count
  );
end;
$$;

create or replace function public.planner_command_workspace_restore(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_backup_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  backup_row public.workspace_backups;
  change_set_id uuid;
  snapshot_row jsonb;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'restore') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into backup_row
  from public.workspace_backups
  where id = p_backup_id
    and workspace_root_id = p_workspace_root_id;

  if backup_row.id is null then
    raise exception 'BACKUP_NOT_FOUND';
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'workspace-restore',
    'Restore workspace backup',
    jsonb_build_object('backupId', p_backup_id)
  );

  if backup_row.snapshot ? 'plannerProject' then
    perform public.planner_restore_snapshot_row('planner-project', backup_row.snapshot -> 'plannerProject', p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end if;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'athletes', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('athlete', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'teams', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('team', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  delete from public.team_coaches
  where exists (
    select 1
    from public.teams t
    where t.id = public.team_coaches.team_id
      and t.workspace_root_id = p_workspace_root_id
  );

  insert into public.team_coaches
  select *
  from jsonb_populate_recordset(null::public.team_coaches, coalesce(backup_row.snapshot -> 'teamCoaches', '[]'::jsonb))
  on conflict (team_id, coach_profile_id) do update
  set role = excluded.role;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'assignments', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('assignment', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in
    select value
    from jsonb_array_elements(coalesce(backup_row.snapshot -> 'tryoutRecords', backup_row.snapshot -> 'evaluations', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('tryout-record', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'skillPlans', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('skill-plan', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'routinePlans', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('routine-plan', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'seasonPlans', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('season-plan', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  return jsonb_build_object(
    'workspaceRootId', p_workspace_root_id,
    'changeSetId', change_set_id,
    'backupId', p_backup_id
  );
end;
$$;

create or replace view public.workspace_entity_versions as
select 'athlete'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.athlete_versions
union all
select 'team'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_versions
union all
select 'assignment'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.athlete_team_assignment_versions
union all
select 'planner-project'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.planner_project_versions
union all
select 'tryout-record'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.planner_tryout_record_versions
union all
select 'skill-plan'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_skill_plan_versions
union all
select 'routine-plan'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_routine_plan_versions
union all
select 'season-plan'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_season_plan_versions;

commit;
