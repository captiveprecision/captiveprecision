create table if not exists public.team_routine_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  planner_project_id text not null,
  status text not null default 'draft',
  notes text not null default '',
  document jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint team_routine_plans_status_check check (status in ('draft', 'approved', 'archived'))
);

create unique index if not exists idx_team_routine_plans_project_team
  on public.team_routine_plans (planner_project_id, team_id);

create index if not exists idx_team_routine_plans_team_id
  on public.team_routine_plans (team_id);

create index if not exists idx_team_routine_plans_updated_at
  on public.team_routine_plans (updated_at desc);

drop trigger if exists set_team_routine_plans_updated_at on public.team_routine_plans;
create trigger set_team_routine_plans_updated_at
  before update on public.team_routine_plans
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.team_routine_plans enable row level security;

drop policy if exists "team_routine_plans_select_related" on public.team_routine_plans;
create policy "team_routine_plans_select_related"
  on public.team_routine_plans for select
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_routine_plans.team_id
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

drop policy if exists "team_routine_plans_insert_related" on public.team_routine_plans;
create policy "team_routine_plans_insert_related"
  on public.team_routine_plans for insert
  with check (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_routine_plans.team_id
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

drop policy if exists "team_routine_plans_update_related" on public.team_routine_plans;
create policy "team_routine_plans_update_related"
  on public.team_routine_plans for update
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_routine_plans.team_id
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

drop policy if exists "team_routine_plans_delete_related" on public.team_routine_plans;
create policy "team_routine_plans_delete_related"
  on public.team_routine_plans for delete
  using (
    exists (
      select 1
      from public.teams t
      left join public.gyms g on g.id = t.gym_id
      where t.id = public.team_routine_plans.team_id
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
