create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text not null unique,
  coach_license_limit integer not null default 0,
  membership_plan_id uuid references public.membership_plans(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles
  add column if not exists role text not null default 'coach',
  add column if not exists membership_type text not null default 'independent',
  add column if not exists primary_gym_id uuid references public.gyms(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'gym', 'coach'));

alter table public.profiles
  drop constraint if exists profiles_membership_type_check;
alter table public.profiles
  add constraint profiles_membership_type_check check (membership_type in ('independent', 'gym_assigned'));

create table if not exists public.gym_coach_licenses (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete cascade,
  license_seat_name text,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  unique (gym_id, coach_profile_id),
  constraint gym_coach_licenses_status_check check (status in ('active', 'inactive', 'pending'))
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  primary_coach_profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  division text,
  season_label text,
  visibility_scope text not null default 'private',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint teams_visibility_scope_check check (visibility_scope in ('private', 'gym', 'organization'))
);

create table if not exists public.team_coaches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  coach_profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'assistant',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (team_id, coach_profile_id),
  constraint team_coaches_role_check check (role in ('assistant', 'head', 'consulting'))
);

create table if not exists public.athletes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete set null,
  first_name text not null,
  last_name text not null,
  birth_date date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.athlete_team_assignments (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (athlete_id, team_id)
);

create table if not exists public.scoring_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint scoring_systems_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.scoring_system_versions (
  id uuid primary key default gen_random_uuid(),
  scoring_system_id uuid not null references public.scoring_systems(id) on delete cascade,
  label text not null,
  season_label text not null,
  status text not null default 'draft',
  is_active boolean not null default false,
  comments text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint scoring_system_versions_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.scoring_sections (
  id uuid primary key default gen_random_uuid(),
  scoring_system_version_id uuid not null references public.scoring_system_versions(id) on delete cascade,
  section_key text not null,
  section_name text not null,
  max_points numeric(10,2) not null default 0,
  guidance text,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_gyms_owner_profile_id
  on public.gyms (owner_profile_id);

create index if not exists idx_gym_coach_licenses_gym_id
  on public.gym_coach_licenses (gym_id);

create index if not exists idx_gym_coach_licenses_coach_profile_id
  on public.gym_coach_licenses (coach_profile_id);

create index if not exists idx_teams_gym_id
  on public.teams (gym_id);

create index if not exists idx_teams_primary_coach_profile_id
  on public.teams (primary_coach_profile_id);

create index if not exists idx_team_coaches_team_id
  on public.team_coaches (team_id);

create index if not exists idx_team_coaches_coach_profile_id
  on public.team_coaches (coach_profile_id);

create index if not exists idx_athletes_gym_id
  on public.athletes (gym_id);

create index if not exists idx_athlete_team_assignments_team_id
  on public.athlete_team_assignments (team_id);

create index if not exists idx_athlete_team_assignments_athlete_id
  on public.athlete_team_assignments (athlete_id);

create index if not exists idx_scoring_system_versions_scoring_system_id
  on public.scoring_system_versions (scoring_system_id);

create index if not exists idx_scoring_sections_version_id
  on public.scoring_sections (scoring_system_version_id);

alter table public.gyms enable row level security;
alter table public.gym_coach_licenses enable row level security;
alter table public.teams enable row level security;
alter table public.team_coaches enable row level security;
alter table public.athletes enable row level security;
alter table public.athlete_team_assignments enable row level security;
alter table public.scoring_systems enable row level security;
alter table public.scoring_system_versions enable row level security;
alter table public.scoring_sections enable row level security;

drop policy if exists "gyms_select_owner" on public.gyms;
create policy "gyms_select_owner"
  on public.gyms for select
  using (owner_profile_id = auth.uid());

drop policy if exists "gym_coach_licenses_select_related" on public.gym_coach_licenses;
create policy "gym_coach_licenses_select_related"
  on public.gym_coach_licenses for select
  using (
    coach_profile_id = auth.uid()
    or exists (
      select 1
      from public.gyms g
      where g.id = public.gym_coach_licenses.gym_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "teams_select_related" on public.teams;
create policy "teams_select_related"
  on public.teams for select
  using (
    primary_coach_profile_id = auth.uid()
    or exists (
      select 1 from public.team_coaches tc
      where tc.team_id = public.teams.id
        and tc.coach_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.gyms g
      where g.id = public.teams.gym_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "team_coaches_select_related" on public.team_coaches;
create policy "team_coaches_select_related"
  on public.team_coaches for select
  using (
    coach_profile_id = auth.uid()
    or exists (
      select 1
      from public.teams t
      join public.gyms g on g.id = t.gym_id
      where t.id = public.team_coaches.team_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "athletes_select_related" on public.athletes;
create policy "athletes_select_related"
  on public.athletes for select
  using (
    exists (
      select 1
      from public.gyms g
      where g.id = public.athletes.gym_id
        and g.owner_profile_id = auth.uid()
    )
    or exists (
      select 1
      from public.athlete_team_assignments ata
      join public.teams t on t.id = ata.team_id
      where ata.athlete_id = public.athletes.id
        and (
          t.primary_coach_profile_id = auth.uid()
          or exists (
            select 1 from public.team_coaches tc
            where tc.team_id = t.id
              and tc.coach_profile_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "athlete_team_assignments_select_related" on public.athlete_team_assignments;
create policy "athlete_team_assignments_select_related"
  on public.athlete_team_assignments for select
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.athlete_team_assignments.team_id
        and (
          t.primary_coach_profile_id = auth.uid()
          or g.owner_profile_id = auth.uid()
          or exists (
            select 1 from public.team_coaches tc
            where tc.team_id = t.id
              and tc.coach_profile_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "scoring_systems_select_all" on public.scoring_systems;
create policy "scoring_systems_select_all"
  on public.scoring_systems for select
  using (true);

drop policy if exists "scoring_system_versions_select_all" on public.scoring_system_versions;
create policy "scoring_system_versions_select_all"
  on public.scoring_system_versions for select
  using (true);

drop policy if exists "scoring_sections_select_all" on public.scoring_sections;
create policy "scoring_sections_select_all"
  on public.scoring_sections for select
  using (true);
