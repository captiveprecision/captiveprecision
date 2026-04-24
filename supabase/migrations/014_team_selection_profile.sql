create or replace function public.planner_command_team_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_expected_lock_version integer default null,
  p_team_id uuid default null,
  p_name text default null,
  p_team_level text default null,
  p_team_type text default null,
  p_team_division text default null,
  p_training_days text default null,
  p_training_hours text default null,
  p_linked_coach_ids uuid[] default '{}'::uuid[],
  p_assigned_coach_names text[] default '{}'::text[],
  p_selection_profile jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  root_row public.workspace_roots;
  current_row public.teams;
  next_row public.teams;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into root_row
  from public.workspace_roots
  where id = p_workspace_root_id;

  if root_row.id is null then
    raise exception 'WORKSPACE_ROOT_NOT_FOUND';
  end if;

  if p_team_id is not null then
    select *
    into current_row
    from public.teams
    where id = p_team_id
      and workspace_root_id = p_workspace_root_id;
  end if;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'team-save',
    'Save team',
    jsonb_build_object('teamId', coalesce(current_row.id, p_team_id))
  );

  if current_row.id is null then
    insert into public.teams (
      workspace_root_id,
      gym_id,
      primary_coach_profile_id,
      name,
      division,
      visibility_scope,
      metadata,
      lock_version,
      last_change_set_id
    )
    values (
      p_workspace_root_id,
      root_row.gym_id,
      coalesce(p_linked_coach_ids[1], p_actor_profile_id),
      trim(coalesce(p_name, 'Team')),
      nullif(trim(coalesce(p_team_division, '')), ''),
      case when root_row.scope_type = 'gym' then 'gym' else 'private' end,
      jsonb_build_object(
        'teamLevel', trim(coalesce(p_team_level, 'Beginner')),
        'ageCategory', trim(coalesce(p_team_type, 'Youth')),
        'trainingDays', coalesce(p_training_days, ''),
        'trainingHours', coalesce(p_training_hours, ''),
        'assignedCoachNames', coalesce(to_jsonb(p_assigned_coach_names), '[]'::jsonb),
        'linkedCoachIds', coalesce(to_jsonb(p_linked_coach_ids), '[]'::jsonb)
      ) || case
        when p_selection_profile is not null then jsonb_build_object('selectionProfile', p_selection_profile)
        else '{}'::jsonb
      end,
      1,
      change_set_id
    )
    returning *
    into next_row;

    change_type := 'create';
  else
    update public.teams
    set
      primary_coach_profile_id = coalesce(p_linked_coach_ids[1], current_row.primary_coach_profile_id, p_actor_profile_id),
      name = coalesce(nullif(trim(p_name), ''), current_row.name),
      division = coalesce(nullif(trim(p_team_division), ''), current_row.division),
      metadata = coalesce(current_row.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'teamLevel', coalesce(nullif(trim(p_team_level), ''), current_row.metadata ->> 'teamLevel', 'Beginner'),
          'ageCategory', coalesce(nullif(trim(p_team_type), ''), current_row.metadata ->> 'ageCategory', 'Youth'),
          'trainingDays', coalesce(p_training_days, current_row.metadata ->> 'trainingDays', ''),
          'trainingHours', coalesce(p_training_hours, current_row.metadata ->> 'trainingHours', ''),
          'assignedCoachNames', coalesce(to_jsonb(p_assigned_coach_names), current_row.metadata -> 'assignedCoachNames', '[]'::jsonb),
          'linkedCoachIds', coalesce(to_jsonb(p_linked_coach_ids), current_row.metadata -> 'linkedCoachIds', '[]'::jsonb)
        )
        || case
          when p_selection_profile is not null then jsonb_build_object('selectionProfile', p_selection_profile)
          else '{}'::jsonb
        end,
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

  delete from public.team_coaches
  where public.team_coaches.team_id = next_row.id;

  if coalesce(array_length(p_linked_coach_ids, 1), 0) > 0 then
    insert into public.team_coaches (team_id, coach_profile_id, role)
    select
      next_row.id,
      coach_id,
      case when ordinality = 1 then 'head' else 'assistant' end
    from unnest(p_linked_coach_ids) with ordinality as linked(coach_id, ordinality);
  end if;

  version_id := public.planner_record_entity_version(
    'team',
    next_row.id::text,
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
    'versionId', version_id
  );
end;
$$;
