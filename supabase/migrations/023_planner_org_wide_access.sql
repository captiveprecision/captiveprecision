begin;

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
  ),
  gym_license as (
    select gcl.*
    from root r
    join public.gym_coach_licenses gcl
      on gcl.gym_id = r.gym_id
     and gcl.coach_profile_id = p_actor_profile_id
     and gcl.status = 'active'
    where r.scope_type = 'gym'
    limit 1
  )
  select case
    when public.planner_actor_is_admin(p_actor_profile_id) then true
    when exists (
      select 1
      from root r
      where r.scope_type = 'coach'
        and r.owner_profile_id = p_actor_profile_id
    ) then true
    when exists (
      select 1
      from root r
      where r.scope_type = 'gym'
        and r.owner_profile_id = p_actor_profile_id
    ) then true
    when p_access in ('restore', 'admin-write', 'team-builder-write') then exists (
      select 1
      from gym_license gl
      where gl.seat_role = 'program_director'
    )
    when p_access = 'plan-write' then exists (
      select 1
      from gym_license gl
      where gl.seat_role in ('program_director', 'coach')
    )
    when p_access in ('read', 'athlete-write', 'tryout-write', 'write') then exists (
      select 1
      from gym_license gl
      where gl.seat_role in ('program_director', 'coach', 'assistant')
    )
    else false
  end;
$$;

commit;
