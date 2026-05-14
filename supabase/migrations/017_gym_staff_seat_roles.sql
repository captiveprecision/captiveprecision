alter table public.gym_coach_licenses
  add column if not exists seat_role text not null default 'coach',
  add column if not exists invited_by_profile_id uuid references public.profiles(id) on delete set null;

alter table public.gym_coach_licenses
  drop constraint if exists gym_coach_licenses_seat_role_check;

alter table public.gym_coach_licenses
  add constraint gym_coach_licenses_seat_role_check
    check (seat_role in ('coach', 'staff', 'assistant'));

update public.gym_coach_licenses
set seat_role = 'coach'
where seat_role is null;
