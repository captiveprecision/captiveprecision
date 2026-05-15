-- Apply this in the Supabase SQL Editor if the CLI is not available.
-- This is safe to rerun.

begin;

create table if not exists public.gym_seasons (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  season_number integer not null,
  label text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'upcoming',
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint gym_seasons_number_check check (season_number > 0),
  constraint gym_seasons_dates_check check (end_date >= start_date),
  constraint gym_seasons_status_check check (status in ('upcoming', 'active', 'closed')),
  unique (gym_id, season_number)
);

create unique index if not exists idx_gym_seasons_one_active
  on public.gym_seasons (gym_id)
  where status = 'active';

create index if not exists idx_gym_seasons_gym_status
  on public.gym_seasons (gym_id, status);

drop trigger if exists set_gym_seasons_updated_at on public.gym_seasons;
create trigger set_gym_seasons_updated_at
  before update on public.gym_seasons
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.gym_seasons enable row level security;

drop policy if exists "gym_seasons_select_related" on public.gym_seasons;
create policy "gym_seasons_select_related"
  on public.gym_seasons for select
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_seasons.gym_id
        and (
          g.owner_profile_id = auth.uid()
          or public.planner_actor_is_admin(auth.uid())
          or exists (
            select 1
            from public.gym_coach_licenses gcl
            where gcl.gym_id = g.id
              and gcl.coach_profile_id = auth.uid()
              and gcl.status = 'active'
          )
        )
    )
  );

drop policy if exists "gym_seasons_insert_admin" on public.gym_seasons;
create policy "gym_seasons_insert_admin"
  on public.gym_seasons for insert
  with check (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_seasons.gym_id
        and (
          g.owner_profile_id = auth.uid()
          or public.planner_actor_is_admin(auth.uid())
          or exists (
            select 1
            from public.gym_coach_licenses gcl
            where gcl.gym_id = g.id
              and gcl.coach_profile_id = auth.uid()
              and gcl.status = 'active'
              and gcl.seat_role = 'program_director'
          )
        )
    )
  );

drop policy if exists "gym_seasons_update_admin" on public.gym_seasons;
create policy "gym_seasons_update_admin"
  on public.gym_seasons for update
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_seasons.gym_id
        and (
          g.owner_profile_id = auth.uid()
          or public.planner_actor_is_admin(auth.uid())
          or exists (
            select 1
            from public.gym_coach_licenses gcl
            where gcl.gym_id = g.id
              and gcl.coach_profile_id = auth.uid()
              and gcl.status = 'active'
              and gcl.seat_role = 'program_director'
          )
        )
    )
  );

commit;
