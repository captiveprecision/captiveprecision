-- Apply this in the Supabase SQL Editor if the CLI is not available.
-- This is safe to rerun.
begin;

alter table public.gym_coach_licenses
  drop constraint if exists gym_coach_licenses_seat_role_check;

alter table public.gym_coach_licenses
  add constraint gym_coach_licenses_seat_role_check
    check (seat_role in ('program_director', 'coach', 'staff', 'assistant'));

insert into public.gym_coach_licenses (
  gym_id,
  coach_profile_id,
  status,
  license_seat_name,
  seat_role,
  invited_by_profile_id
)
select
  g.id,
  g.owner_profile_id,
  'active',
  coalesce(p.display_name, p.email, 'Program Director'),
  'program_director',
  g.owner_profile_id
from public.gyms g
left join public.profiles p
  on p.id = g.owner_profile_id
where g.owner_profile_id is not null
on conflict (gym_id, coach_profile_id) do update
set
  status = 'active',
  seat_role = 'program_director',
  license_seat_name = coalesce(excluded.license_seat_name, public.gym_coach_licenses.license_seat_name),
  updated_at = timezone('utc'::text, now());

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
    when p_access = 'restore' then exists (
      select 1
      from gym_license gl
      where gl.seat_role = 'program_director'
    )
    when p_access = 'write' then exists (
      select 1
      from gym_license gl
      where gl.seat_role in ('program_director', 'coach')
    )
    else exists (
      select 1
      from gym_license gl
      where gl.seat_role in ('program_director', 'coach', 'assistant')
    )
  end;
$$;

commit;
