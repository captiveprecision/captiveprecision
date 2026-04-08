alter table public.athletes
  add column if not exists registration_number text,
  add column if not exists notes text not null default '',
  add column if not exists parent_contacts jsonb not null default '[]'::jsonb,
  add column if not exists created_by_profile_id uuid references public.profiles(id) on delete set null;

update public.athletes
set
  registration_number = coalesce(
    nullif(public.athletes.registration_number, ''),
    nullif(public.athletes.metadata ->> 'registrationNumber', ''),
    upper(left(public.athletes.id::text, 8))
  ),
  notes = coalesce(
    nullif(public.athletes.notes, ''),
    coalesce(public.athletes.metadata ->> 'notes', '')
  ),
  parent_contacts = case
    when jsonb_typeof(public.athletes.parent_contacts) = 'array' then public.athletes.parent_contacts
    when jsonb_typeof(public.athletes.metadata -> 'parentContacts') = 'array' then public.athletes.metadata -> 'parentContacts'
    else '[]'::jsonb
  end,
  created_by_profile_id = coalesce(
    public.athletes.created_by_profile_id,
    case
      when coalesce(public.athletes.metadata ->> 'createdByProfileId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (public.athletes.metadata ->> 'createdByProfileId')::uuid
      else null
    end
  );

create index if not exists idx_athletes_registration_number
  on public.athletes (registration_number);

create index if not exists idx_athletes_created_by_profile_id
  on public.athletes (created_by_profile_id);

drop trigger if exists set_athletes_updated_at on public.athletes;
create trigger set_athletes_updated_at
  before update on public.athletes
  for each row execute procedure public.set_current_timestamp_updated_at();

create table if not exists public.planner_projects (
  id text primary key,
  scope_type text not null,
  owner_profile_id uuid references public.profiles(id) on delete cascade,
  gym_id uuid references public.gyms(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  pipeline_stage text not null default 'tryouts',
  template jsonb not null default '{}'::jsonb,
  qualification_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint planner_projects_scope_check check (scope_type in ('coach', 'gym')),
  constraint planner_projects_status_check check (status in ('draft', 'active', 'archived')),
  constraint planner_projects_pipeline_stage_check check (pipeline_stage in ('tryouts', 'team-builder', 'skill-planner', 'routine-builder', 'season-planner', 'my-teams'))
);

create index if not exists idx_planner_projects_owner_profile_id
  on public.planner_projects (owner_profile_id);

create index if not exists idx_planner_projects_gym_id
  on public.planner_projects (gym_id);

drop trigger if exists set_planner_projects_updated_at on public.planner_projects;
create trigger set_planner_projects_updated_at
  before update on public.planner_projects
  for each row execute procedure public.set_current_timestamp_updated_at();

create table if not exists public.planner_evaluations (
  id text primary key,
  planner_project_id text not null references public.planner_projects(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  occurred_at timestamptz,
  record jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists idx_planner_evaluations_project_id
  on public.planner_evaluations (planner_project_id);

create index if not exists idx_planner_evaluations_athlete_id
  on public.planner_evaluations (athlete_id);

create index if not exists idx_planner_evaluations_occurred_at
  on public.planner_evaluations (occurred_at desc);

drop trigger if exists set_planner_evaluations_updated_at on public.planner_evaluations;
create trigger set_planner_evaluations_updated_at
  before update on public.planner_evaluations
  for each row execute procedure public.set_current_timestamp_updated_at();

create table if not exists public.team_skill_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  planner_project_id text not null references public.planner_projects(id) on delete cascade,
  status text not null default 'draft',
  notes text not null default '',
  selections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint team_skill_plans_status_check check (status in ('draft', 'approved', 'archived'))
);

create unique index if not exists idx_team_skill_plans_project_team
  on public.team_skill_plans (planner_project_id, team_id);

create index if not exists idx_team_skill_plans_team_id
  on public.team_skill_plans (team_id);

create index if not exists idx_team_skill_plans_project_id
  on public.team_skill_plans (planner_project_id);

drop trigger if exists set_team_skill_plans_updated_at on public.team_skill_plans;
create trigger set_team_skill_plans_updated_at
  before update on public.team_skill_plans
  for each row execute procedure public.set_current_timestamp_updated_at();

create table if not exists public.team_season_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  planner_project_id text not null references public.planner_projects(id) on delete cascade,
  status text not null default 'draft',
  notes text not null default '',
  checkpoints jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint team_season_plans_status_check check (status in ('draft', 'approved', 'archived'))
);

create unique index if not exists idx_team_season_plans_project_team
  on public.team_season_plans (planner_project_id, team_id);

create index if not exists idx_team_season_plans_team_id
  on public.team_season_plans (team_id);

create index if not exists idx_team_season_plans_project_id
  on public.team_season_plans (planner_project_id);

drop trigger if exists set_team_season_plans_updated_at on public.team_season_plans;
create trigger set_team_season_plans_updated_at
  before update on public.team_season_plans
  for each row execute procedure public.set_current_timestamp_updated_at();

create index if not exists idx_team_routine_plans_project_id
  on public.team_routine_plans (planner_project_id);

alter table public.planner_projects enable row level security;
alter table public.planner_evaluations enable row level security;
alter table public.team_skill_plans enable row level security;
alter table public.team_season_plans enable row level security;

drop policy if exists "planner_projects_select_related" on public.planner_projects;
create policy "planner_projects_select_related"
  on public.planner_projects for select
  using (
    (scope_type = 'coach' and owner_profile_id = auth.uid())
    or exists (
      select 1
      from public.gyms g
      where g.id = public.planner_projects.gym_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "planner_projects_insert_related" on public.planner_projects;
create policy "planner_projects_insert_related"
  on public.planner_projects for insert
  with check (
    (scope_type = 'coach' and owner_profile_id = auth.uid())
    or exists (
      select 1
      from public.gyms g
      where g.id = public.planner_projects.gym_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "planner_projects_update_related" on public.planner_projects;
create policy "planner_projects_update_related"
  on public.planner_projects for update
  using (
    (scope_type = 'coach' and owner_profile_id = auth.uid())
    or exists (
      select 1
      from public.gyms g
      where g.id = public.planner_projects.gym_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "planner_projects_delete_related" on public.planner_projects;
create policy "planner_projects_delete_related"
  on public.planner_projects for delete
  using (
    (scope_type = 'coach' and owner_profile_id = auth.uid())
    or exists (
      select 1
      from public.gyms g
      where g.id = public.planner_projects.gym_id
        and g.owner_profile_id = auth.uid()
    )
  );

drop policy if exists "planner_evaluations_select_related" on public.planner_evaluations;
create policy "planner_evaluations_select_related"
  on public.planner_evaluations for select
  using (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_evaluations.planner_project_id
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

drop policy if exists "planner_evaluations_insert_related" on public.planner_evaluations;
create policy "planner_evaluations_insert_related"
  on public.planner_evaluations for insert
  with check (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_evaluations.planner_project_id
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

drop policy if exists "planner_evaluations_update_related" on public.planner_evaluations;
create policy "planner_evaluations_update_related"
  on public.planner_evaluations for update
  using (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_evaluations.planner_project_id
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

drop policy if exists "planner_evaluations_delete_related" on public.planner_evaluations;
create policy "planner_evaluations_delete_related"
  on public.planner_evaluations for delete
  using (
    exists (
      select 1
      from public.planner_projects pp
      where pp.id = public.planner_evaluations.planner_project_id
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

drop policy if exists "team_skill_plans_select_related" on public.team_skill_plans;
create policy "team_skill_plans_select_related"
  on public.team_skill_plans for select
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_skill_plans.team_id
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

drop policy if exists "team_skill_plans_insert_related" on public.team_skill_plans;
create policy "team_skill_plans_insert_related"
  on public.team_skill_plans for insert
  with check (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_skill_plans.team_id
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

drop policy if exists "team_skill_plans_update_related" on public.team_skill_plans;
create policy "team_skill_plans_update_related"
  on public.team_skill_plans for update
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_skill_plans.team_id
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

drop policy if exists "team_skill_plans_delete_related" on public.team_skill_plans;
create policy "team_skill_plans_delete_related"
  on public.team_skill_plans for delete
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_skill_plans.team_id
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

drop policy if exists "team_season_plans_select_related" on public.team_season_plans;
create policy "team_season_plans_select_related"
  on public.team_season_plans for select
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_season_plans.team_id
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

drop policy if exists "team_season_plans_insert_related" on public.team_season_plans;
create policy "team_season_plans_insert_related"
  on public.team_season_plans for insert
  with check (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_season_plans.team_id
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

drop policy if exists "team_season_plans_update_related" on public.team_season_plans;
create policy "team_season_plans_update_related"
  on public.team_season_plans for update
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_season_plans.team_id
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

drop policy if exists "team_season_plans_delete_related" on public.team_season_plans;
create policy "team_season_plans_delete_related"
  on public.team_season_plans for delete
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_season_plans.team_id
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
