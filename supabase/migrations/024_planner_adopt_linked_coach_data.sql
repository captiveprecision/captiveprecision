begin;

create or replace function public.planner_adopt_coach_workspace_into_gym(
  p_coach_profile_id uuid,
  p_gym_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_root public.workspace_roots;
  gym_root public.workspace_roots;
  gym_project public.planner_projects;
  adopted_athletes integer := 0;
  adopted_teams integer := 0;
  adopted_assignments integer := 0;
  adopted_tryouts integer := 0;
  adopted_skill_plans integer := 0;
  adopted_routine_plans integer := 0;
  adopted_season_plans integer := 0;
begin
  select *
  into coach_root
  from public.workspace_roots
  where scope_type = 'coach'
    and owner_profile_id = p_coach_profile_id
  limit 1;

  if coach_root.id is null then
    return jsonb_build_object('adopted', false, 'reason', 'coach_root_not_found');
  end if;

  select *
  into gym_root
  from public.workspace_roots
  where scope_type = 'gym'
    and gym_id = p_gym_id
  limit 1;

  if gym_root.id is null then
    insert into public.workspace_roots (scope_type, owner_profile_id, gym_id, status)
    select 'gym', g.owner_profile_id, g.id, 'active'
    from public.gyms g
    where g.id = p_gym_id
    returning *
    into gym_root;
  end if;

  gym_project := public.planner_ensure_project_row(gym_root.id);

  update public.athletes a
  set
    workspace_root_id = gym_root.id,
    gym_id = p_gym_id,
    updated_at = timezone('utc'::text, now())
  where a.workspace_root_id = coach_root.id
    and (
      a.registration_number is null
      or not exists (
        select 1
        from public.athletes existing
        where existing.workspace_root_id = gym_root.id
          and existing.registration_number = a.registration_number
          and existing.deleted_at is null
          and existing.id <> a.id
      )
    );
  get diagnostics adopted_athletes = row_count;

  update public.teams
  set
    workspace_root_id = gym_root.id,
    gym_id = p_gym_id,
    visibility_scope = 'gym',
    updated_at = timezone('utc'::text, now())
  where workspace_root_id = coach_root.id;
  get diagnostics adopted_teams = row_count;

  update public.athlete_team_assignments ata
  set
    workspace_root_id = gym_root.id,
    updated_at = timezone('utc'::text, now())
  where ata.workspace_root_id = coach_root.id
    or exists (
      select 1
      from public.athletes a
      where a.id = ata.athlete_id
        and a.workspace_root_id = gym_root.id
    )
    or exists (
      select 1
      from public.teams t
      where t.id = ata.team_id
        and t.workspace_root_id = gym_root.id
    );
  get diagnostics adopted_assignments = row_count;

  if to_regclass('public.planner_tryout_records') is not null then
    update public.planner_tryout_records ptr
    set
      workspace_root_id = gym_root.id,
      planner_project_id = gym_project.id,
      updated_at = timezone('utc'::text, now())
    where ptr.workspace_root_id = coach_root.id
      or exists (
        select 1
        from public.athletes a
        where a.id = ptr.athlete_id
          and a.workspace_root_id = gym_root.id
      );
    get diagnostics adopted_tryouts = row_count;
  end if;

  update public.team_skill_plans sp
  set
    workspace_root_id = gym_root.id,
    planner_project_id = gym_project.id,
    updated_at = timezone('utc'::text, now())
  where sp.workspace_root_id = coach_root.id
    and not exists (
      select 1
      from public.team_skill_plans existing
      where existing.planner_project_id = gym_project.id
        and existing.team_id = sp.team_id
        and existing.id <> sp.id
    );
  get diagnostics adopted_skill_plans = row_count;

  update public.team_routine_plans rp
  set
    workspace_root_id = gym_root.id,
    planner_project_id = gym_project.id,
    updated_at = timezone('utc'::text, now())
  where rp.workspace_root_id = coach_root.id
    and not exists (
      select 1
      from public.team_routine_plans existing
      where existing.planner_project_id = gym_project.id
        and existing.team_id = rp.team_id
        and existing.id <> rp.id
    );
  get diagnostics adopted_routine_plans = row_count;

  update public.team_season_plans sep
  set
    workspace_root_id = gym_root.id,
    planner_project_id = gym_project.id,
    updated_at = timezone('utc'::text, now())
  where sep.workspace_root_id = coach_root.id
    and not exists (
      select 1
      from public.team_season_plans existing
      where existing.planner_project_id = gym_project.id
        and existing.team_id = sep.team_id
        and existing.id <> sep.id
    );
  get diagnostics adopted_season_plans = row_count;

  return jsonb_build_object(
    'adopted', true,
    'coachWorkspaceRootId', coach_root.id,
    'gymWorkspaceRootId', gym_root.id,
    'athletes', adopted_athletes,
    'teams', adopted_teams,
    'assignments', adopted_assignments,
    'tryouts', adopted_tryouts,
    'skillPlans', adopted_skill_plans,
    'routinePlans', adopted_routine_plans,
    'seasonPlans', adopted_season_plans
  );
end;
$$;

do $$
declare
  license_row record;
begin
  for license_row in
    select distinct gym_id, coach_profile_id
    from public.gym_coach_licenses
    where status = 'active'
      and gym_id is not null
      and coach_profile_id is not null
  loop
    perform public.planner_adopt_coach_workspace_into_gym(
      license_row.coach_profile_id,
      license_row.gym_id
    );
  end loop;
end
$$;

commit;
