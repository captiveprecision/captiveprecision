begin;

create table if not exists public.gym_team_season_profiles (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_season_id uuid not null references public.gym_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  name_snapshot text not null,
  level_label text,
  category text,
  division text,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint gym_team_season_profiles_status_check check (status in ('active', 'inactive', 'archived')),
  unique (gym_season_id, team_id)
);

create table if not exists public.gym_team_season_coaches (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_season_id uuid not null references public.gym_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'assistant',
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint gym_team_season_coaches_role_check check (role in ('assistant', 'head', 'consulting')),
  unique (gym_season_id, team_id, coach_profile_id)
);

create table if not exists public.gym_team_season_roster (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  gym_season_id uuid not null references public.gym_seasons(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (gym_season_id, team_id, athlete_id)
);

create index if not exists idx_gym_team_season_profiles_gym_season
  on public.gym_team_season_profiles (gym_id, gym_season_id, status);

create index if not exists idx_gym_team_season_profiles_team
  on public.gym_team_season_profiles (team_id);

create index if not exists idx_gym_team_season_coaches_team
  on public.gym_team_season_coaches (gym_season_id, team_id);

create index if not exists idx_gym_team_season_coaches_coach
  on public.gym_team_season_coaches (coach_profile_id);

create index if not exists idx_gym_team_season_roster_team
  on public.gym_team_season_roster (gym_season_id, team_id);

create index if not exists idx_gym_team_season_roster_athlete
  on public.gym_team_season_roster (athlete_id);

drop trigger if exists set_gym_team_season_profiles_updated_at on public.gym_team_season_profiles;
create trigger set_gym_team_season_profiles_updated_at
  before update on public.gym_team_season_profiles
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.gym_team_season_profiles enable row level security;
alter table public.gym_team_season_coaches enable row level security;
alter table public.gym_team_season_roster enable row level security;

drop policy if exists "gym_team_season_profiles_select_related" on public.gym_team_season_profiles;
create policy "gym_team_season_profiles_select_related"
  on public.gym_team_season_profiles for select
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_profiles.gym_id
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

drop policy if exists "gym_team_season_profiles_admin_write" on public.gym_team_season_profiles;
create policy "gym_team_season_profiles_admin_write"
  on public.gym_team_season_profiles for all
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_profiles.gym_id
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
  )
  with check (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_profiles.gym_id
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

drop policy if exists "gym_team_season_coaches_select_related" on public.gym_team_season_coaches;
create policy "gym_team_season_coaches_select_related"
  on public.gym_team_season_coaches for select
  using (
    coach_profile_id = auth.uid()
    or exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_coaches.gym_id
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

drop policy if exists "gym_team_season_coaches_admin_write" on public.gym_team_season_coaches;
create policy "gym_team_season_coaches_admin_write"
  on public.gym_team_season_coaches for all
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_coaches.gym_id
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
  )
  with check (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_coaches.gym_id
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

drop policy if exists "gym_team_season_roster_select_related" on public.gym_team_season_roster;
create policy "gym_team_season_roster_select_related"
  on public.gym_team_season_roster for select
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_roster.gym_id
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

drop policy if exists "gym_team_season_roster_admin_write" on public.gym_team_season_roster;
create policy "gym_team_season_roster_admin_write"
  on public.gym_team_season_roster for all
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_roster.gym_id
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
  )
  with check (
    exists (
      select 1
      from public.gyms g
      where g.id = public.gym_team_season_roster.gym_id
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

insert into public.gym_seasons (
  gym_id,
  season_number,
  label,
  start_date,
  end_date,
  status,
  created_by_profile_id
)
select
  g.id,
  coalesce((
    select max(gs.season_number) + 1
    from public.gym_seasons gs
    where gs.gym_id = g.id
  ), 1),
  'Season ' || coalesce((
    select max(gs.season_number) + 1
    from public.gym_seasons gs
    where gs.gym_id = g.id
  ), 1)::text,
  current_date,
  (current_date + interval '1 year')::date,
  'active',
  g.owner_profile_id
from public.gyms g
where not exists (
  select 1
  from public.gym_seasons active_gs
  where active_gs.gym_id = g.id
    and active_gs.status = 'active'
);

insert into public.gym_team_season_profiles (
  gym_id,
  gym_season_id,
  team_id,
  name_snapshot,
  level_label,
  category,
  division,
  status,
  metadata
)
select
  t.gym_id,
  gs.id,
  t.id,
  t.name,
  nullif(t.metadata ->> 'teamLevel', ''),
  coalesce(nullif(t.metadata ->> 'ageCategory', ''), nullif(t.division, '')),
  t.division,
  'active',
  jsonb_build_object('backfilledFrom', 'teams-current-state')
from public.teams t
join public.gym_seasons gs
  on gs.gym_id = t.gym_id
 and gs.status = 'active'
where t.gym_id is not null
  and coalesce(t.deleted_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
on conflict (gym_season_id, team_id) do nothing;

insert into public.gym_team_season_coaches (
  gym_id,
  gym_season_id,
  team_id,
  coach_profile_id,
  role
)
select
  gtsp.gym_id,
  gtsp.gym_season_id,
  tc.team_id,
  tc.coach_profile_id,
  tc.role
from public.team_coaches tc
join public.gym_team_season_profiles gtsp
  on gtsp.team_id = tc.team_id
 and gtsp.status = 'active'
on conflict (gym_season_id, team_id, coach_profile_id) do nothing;

insert into public.gym_team_season_roster (
  gym_id,
  gym_season_id,
  team_id,
  athlete_id
)
select
  gtsp.gym_id,
  gtsp.gym_season_id,
  ata.team_id,
  ata.athlete_id
from public.athlete_team_assignments ata
join public.gym_team_season_profiles gtsp
  on gtsp.team_id = ata.team_id
 and gtsp.status = 'active'
where coalesce(ata.deleted_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
on conflict (gym_season_id, team_id, athlete_id) do nothing;

update public.planner_tryout_records ptr
set record = coalesce(ptr.record, '{}'::jsonb) || jsonb_build_object(
  'gymSeasonId', gs.id,
  'gymSeasonNumber', gs.season_number,
  'gymSeasonLabel', gs.label
)
from public.athletes a
join public.gym_seasons gs
  on gs.gym_id = a.gym_id
where ptr.athlete_id = a.id
  and a.gym_id is not null
  and not (coalesce(ptr.record, '{}'::jsonb) ? 'gymSeasonId')
  and coalesce(ptr.occurred_at, ptr.created_at)::date >= gs.start_date
  and coalesce(ptr.occurred_at, ptr.created_at)::date <= gs.end_date;

commit;
