alter table public.team_season_plans
  add column if not exists manual_entries jsonb not null default '[]'::jsonb;

create or replace function public.planner_command_season_plan_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_expected_lock_version integer default null,
  p_status text default 'draft',
  p_notes text default '',
  p_checkpoints jsonb default '[]'::jsonb,
  p_manual_entries jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row public.planner_projects;
  current_row public.team_season_plans;
  next_row public.team_season_plans;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  project_row := public.planner_ensure_project_row(p_workspace_root_id);

  select *
  into current_row
  from public.team_season_plans
  where planner_project_id = project_row.id
    and team_id = p_team_id;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'season-plan-save',
    'Save season plan',
    jsonb_build_object('teamId', p_team_id)
  );

  insert into public.team_season_plans (
    id,
    workspace_root_id,
    planner_project_id,
    team_id,
    status,
    notes,
    checkpoints,
    manual_entries,
    lock_version,
    last_change_set_id,
    deleted_at,
    deleted_by_profile_id,
    restored_from_version_id
  )
  values (
    coalesce(current_row.id, gen_random_uuid()),
    p_workspace_root_id,
    project_row.id,
    p_team_id,
    coalesce(nullif(trim(p_status), ''), 'draft'),
    coalesce(p_notes, ''),
    coalesce(p_checkpoints, '[]'::jsonb),
    coalesce(p_manual_entries, '[]'::jsonb),
    case when current_row.id is null then 1 else current_row.lock_version + 1 end,
    change_set_id,
    null,
    null,
    null
  )
  on conflict (planner_project_id, team_id) do update
  set
    status = excluded.status,
    notes = excluded.notes,
    checkpoints = excluded.checkpoints,
    manual_entries = excluded.manual_entries,
    workspace_root_id = excluded.workspace_root_id,
    last_change_set_id = excluded.last_change_set_id,
    deleted_at = null,
    deleted_by_profile_id = null,
    restored_from_version_id = null,
    lock_version = case when current_row.id is null then public.team_season_plans.lock_version + 1 else excluded.lock_version end
  returning *
  into next_row;

  change_type := case
    when current_row.id is null then 'create'
    when current_row.deleted_at is not null then 'restore'
    else 'update'
  end;

  version_id := public.planner_record_entity_version(
    'season-plan',
    next_row.id::text,
    p_workspace_root_id,
    next_row.lock_version,
    change_type,
    row_to_json(next_row)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object('entity', row_to_json(next_row)::jsonb, 'lockVersion', next_row.lock_version, 'changeSetId', change_set_id, 'latestVersionNumber', next_row.lock_version, 'versionId', version_id);
end;
$$;
