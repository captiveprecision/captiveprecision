create table if not exists public.workspace_roots (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null,
  owner_profile_id uuid references public.profiles(id) on delete set null,
  gym_id uuid references public.gyms(id) on delete set null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint workspace_roots_scope_check check (scope_type in ('coach', 'gym')),
  constraint workspace_roots_status_check check (status in ('active', 'archived'))
);

create unique index if not exists idx_workspace_roots_coach_owner
  on public.workspace_roots (owner_profile_id, scope_type)
  where scope_type = 'coach';

create unique index if not exists idx_workspace_roots_gym_id
  on public.workspace_roots (gym_id)
  where gym_id is not null;

drop trigger if exists set_workspace_roots_updated_at on public.workspace_roots;
create trigger set_workspace_roots_updated_at
  before update on public.workspace_roots
  for each row execute procedure public.set_current_timestamp_updated_at();

create table if not exists public.workspace_change_sets (
  id uuid primary key default gen_random_uuid(),
  workspace_root_id uuid not null references public.workspace_roots(id) on delete cascade,
  action text not null,
  summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.workspace_change_events (
  id uuid primary key default gen_random_uuid(),
  workspace_root_id uuid not null references public.workspace_roots(id) on delete cascade,
  change_set_id uuid not null references public.workspace_change_sets(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  change_type text not null,
  version_table text not null,
  version_id uuid not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint workspace_change_events_entity_type_check check (
    entity_type in ('athlete', 'team', 'assignment', 'planner-project', 'evaluation', 'skill-plan', 'routine-plan', 'season-plan')
  ),
  constraint workspace_change_events_change_type_check check (
    change_type in ('create', 'update', 'archive', 'delete', 'restore', 'reassign')
  )
);

create table if not exists public.workspace_backups (
  id uuid primary key default gen_random_uuid(),
  workspace_root_id uuid not null references public.workspace_roots(id) on delete cascade,
  backup_type text not null,
  status text not null default 'ready',
  snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  triggered_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  expires_at timestamptz,
  constraint workspace_backups_status_check check (status in ('ready', 'failed'))
);

create index if not exists idx_workspace_change_sets_root_created
  on public.workspace_change_sets (workspace_root_id, created_at desc);

create index if not exists idx_workspace_change_events_root_created
  on public.workspace_change_events (workspace_root_id, created_at desc);

create index if not exists idx_workspace_backups_root_created
  on public.workspace_backups (workspace_root_id, created_at desc);

alter table public.athletes
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

alter table public.teams
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

alter table public.athlete_team_assignments
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.planner_projects
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

alter table public.planner_evaluations
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

alter table public.team_skill_plans
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

alter table public.team_routine_plans
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

alter table public.team_season_plans
  add column if not exists workspace_root_id uuid references public.workspace_roots(id) on delete restrict,
  add column if not exists lock_version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists restored_from_version_id uuid,
  add column if not exists last_change_set_id uuid references public.workspace_change_sets(id) on delete set null;

drop trigger if exists set_athlete_team_assignments_updated_at on public.athlete_team_assignments;
create trigger set_athlete_team_assignments_updated_at
  before update on public.athlete_team_assignments
  for each row execute procedure public.set_current_timestamp_updated_at();

insert into public.workspace_roots (scope_type, owner_profile_id, status)
select 'coach', p.id, 'active'
from public.profiles p
where not exists (
  select 1
  from public.workspace_roots wr
  where wr.scope_type = 'coach'
    and wr.owner_profile_id = p.id
);

insert into public.workspace_roots (scope_type, owner_profile_id, gym_id, status)
select 'gym', g.owner_profile_id, g.id, 'active'
from public.gyms g
where not exists (
  select 1
  from public.workspace_roots wr
  where wr.scope_type = 'gym'
    and wr.gym_id = g.id
);

update public.planner_projects pp
set workspace_root_id = wr.id
from public.workspace_roots wr
where pp.workspace_root_id is null
  and (
    (pp.scope_type = 'coach' and wr.scope_type = 'coach' and wr.owner_profile_id = pp.owner_profile_id)
    or (pp.scope_type = 'gym' and wr.scope_type = 'gym' and wr.gym_id = pp.gym_id)
  );

update public.teams t
set workspace_root_id = wr.id
from public.workspace_roots wr
where t.workspace_root_id is null
  and (
    (t.gym_id is not null and wr.scope_type = 'gym' and wr.gym_id = t.gym_id)
    or (t.gym_id is null and wr.scope_type = 'coach' and wr.owner_profile_id = t.primary_coach_profile_id)
  );

update public.athletes a
set workspace_root_id = wr.id
from public.workspace_roots wr
where a.workspace_root_id is null
  and (
    (a.gym_id is not null and wr.scope_type = 'gym' and wr.gym_id = a.gym_id)
    or (a.gym_id is null and wr.scope_type = 'coach' and wr.owner_profile_id = a.created_by_profile_id)
  );

update public.athlete_team_assignments ata
set workspace_root_id = coalesce(t.workspace_root_id, a.workspace_root_id)
from public.teams t, public.athletes a
where ata.team_id = t.id
  and a.id = ata.athlete_id
  and ata.workspace_root_id is null;

update public.planner_evaluations pe
set workspace_root_id = pp.workspace_root_id
from public.planner_projects pp
where pe.planner_project_id = pp.id
  and pe.workspace_root_id is null;

update public.team_skill_plans tsp
set workspace_root_id = pp.workspace_root_id
from public.planner_projects pp
where tsp.planner_project_id = pp.id
  and tsp.workspace_root_id is null;

update public.team_routine_plans trp
set workspace_root_id = pp.workspace_root_id
from public.planner_projects pp
where trp.planner_project_id = pp.id
  and trp.workspace_root_id is null;

update public.team_season_plans tsp
set workspace_root_id = pp.workspace_root_id
from public.planner_projects pp
where tsp.planner_project_id = pp.id
  and tsp.workspace_root_id is null;

create unique index if not exists idx_planner_projects_workspace_root_current
  on public.planner_projects (workspace_root_id)
  where deleted_at is null;

create unique index if not exists idx_athletes_workspace_registration_active
  on public.athletes (workspace_root_id, registration_number)
  where registration_number is not null and deleted_at is null;

create index if not exists idx_teams_workspace_root_active
  on public.teams (workspace_root_id, deleted_at);

create index if not exists idx_athletes_workspace_root_active
  on public.athletes (workspace_root_id, deleted_at);

create index if not exists idx_assignments_workspace_root_active
  on public.athlete_team_assignments (workspace_root_id, deleted_at);

create index if not exists idx_planner_evaluations_workspace_root_active
  on public.planner_evaluations (workspace_root_id, deleted_at);

create index if not exists idx_team_skill_plans_workspace_root_active
  on public.team_skill_plans (workspace_root_id, deleted_at);

create index if not exists idx_team_routine_plans_workspace_root_active
  on public.team_routine_plans (workspace_root_id, deleted_at);

create index if not exists idx_team_season_plans_workspace_root_active
  on public.team_season_plans (workspace_root_id, deleted_at);

create table if not exists public.athlete_versions (
  id uuid primary key default gen_random_uuid(),
  entity_id text not null,
  workspace_root_id uuid not null references public.workspace_roots(id) on delete cascade,
  version_number integer not null,
  change_type text not null,
  snapshot jsonb not null default '{}'::jsonb,
  changed_by_profile_id uuid references public.profiles(id) on delete set null,
  change_set_id uuid not null references public.workspace_change_sets(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (entity_id, version_number),
  constraint athlete_versions_change_type_check check (change_type in ('create', 'update', 'archive', 'delete', 'restore', 'reassign'))
);

create table if not exists public.team_versions (
  like public.athlete_versions including all
);

create table if not exists public.athlete_team_assignment_versions (
  like public.athlete_versions including all
);

create table if not exists public.planner_project_versions (
  like public.athlete_versions including all
);

create table if not exists public.planner_evaluation_versions (
  like public.athlete_versions including all
);

create table if not exists public.team_skill_plan_versions (
  like public.athlete_versions including all
);

create table if not exists public.team_routine_plan_versions (
  like public.athlete_versions including all
);

create table if not exists public.team_season_plan_versions (
  like public.athlete_versions including all
);

create index if not exists idx_athlete_versions_root_entity_created
  on public.athlete_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_team_versions_root_entity_created
  on public.team_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_assignment_versions_root_entity_created
  on public.athlete_team_assignment_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_project_versions_root_entity_created
  on public.planner_project_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_evaluation_versions_root_entity_created
  on public.planner_evaluation_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_skill_versions_root_entity_created
  on public.team_skill_plan_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_routine_versions_root_entity_created
  on public.team_routine_plan_versions (workspace_root_id, entity_id, created_at desc);

create index if not exists idx_season_versions_root_entity_created
  on public.team_season_plan_versions (workspace_root_id, entity_id, created_at desc);

create or replace function public.planner_actor_is_admin(p_actor_profile_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_actor_profile_id
      and p.role = 'admin'
  );
$$;

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
  )
  select case
    when public.planner_actor_is_admin(p_actor_profile_id) then true
    when exists (
      select 1
      from root r
      where r.scope_type = 'coach'
        and r.owner_profile_id = p_actor_profile_id
    ) then true
    when p_access = 'restore' then exists (
      select 1
      from root r
      where r.scope_type = 'gym'
        and r.owner_profile_id = p_actor_profile_id
    )
    else exists (
      select 1
      from root r
      where r.scope_type = 'gym'
        and (
          r.owner_profile_id = p_actor_profile_id
          or exists (
            select 1
            from public.gym_coach_licenses gcl
            where gcl.gym_id = r.gym_id
              and gcl.coach_profile_id = p_actor_profile_id
              and gcl.status = 'active'
          )
        )
    )
  end;
$$;

create or replace function public.planner_resolve_workspace_root(
  p_actor_profile_id uuid,
  p_scope_type text,
  p_gym_id uuid default null
)
returns public.workspace_roots
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_gym_id uuid;
  root_row public.workspace_roots;
begin
  if p_scope_type = 'gym' then
    select coalesce(
      p_gym_id,
      p.primary_gym_id,
      owned_gym.id,
      licensed_gym.gym_id
    )
    into resolved_gym_id
    from public.profiles p
    left join lateral (
      select g.id
      from public.gyms g
      where g.owner_profile_id = p_actor_profile_id
      order by g.created_at asc
      limit 1
    ) owned_gym on true
    left join lateral (
      select gcl.gym_id
      from public.gym_coach_licenses gcl
      where gcl.coach_profile_id = p_actor_profile_id
        and gcl.status = 'active'
      order by gcl.created_at asc
      limit 1
    ) licensed_gym on true
    where p.id = p_actor_profile_id;

    if resolved_gym_id is null then
      raise exception 'GYM_WORKSPACE_REQUIRED';
    end if;

    select *
    into root_row
    from public.workspace_roots wr
    where wr.scope_type = 'gym'
      and wr.gym_id = resolved_gym_id
    limit 1;

    if root_row.id is null then
      insert into public.workspace_roots (scope_type, owner_profile_id, gym_id, status)
      select 'gym', g.owner_profile_id, g.id, 'active'
      from public.gyms g
      where g.id = resolved_gym_id
      returning *
      into root_row;
    end if;

    return root_row;
  end if;

  select *
  into root_row
  from public.workspace_roots wr
  where wr.scope_type = 'coach'
    and wr.owner_profile_id = p_actor_profile_id
  limit 1;

  if root_row.id is null then
    insert into public.workspace_roots (scope_type, owner_profile_id, status)
    values ('coach', p_actor_profile_id, 'active')
    returning *
    into root_row;
  end if;

  return root_row;
end;
$$;

create or replace function public.planner_create_change_set(
  p_workspace_root_id uuid,
  p_actor_profile_id uuid,
  p_action text,
  p_summary text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  next_id uuid;
begin
  insert into public.workspace_change_sets (
    workspace_root_id,
    action,
    summary,
    metadata,
    created_by_profile_id
  )
  values (
    p_workspace_root_id,
    p_action,
    p_summary,
    coalesce(p_metadata, '{}'::jsonb),
    p_actor_profile_id
  )
  returning id
  into next_id;

  return next_id;
end;
$$;

create or replace function public.planner_record_change_event(
  p_workspace_root_id uuid,
  p_change_set_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_change_type text,
  p_version_table text,
  p_version_id uuid,
  p_snapshot jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_change_events (
    workspace_root_id,
    change_set_id,
    entity_type,
    entity_id,
    change_type,
    version_table,
    version_id,
    snapshot
  )
  values (
    p_workspace_root_id,
    p_change_set_id,
    p_entity_type,
    p_entity_id,
    p_change_type,
    p_version_table,
    p_version_id,
    coalesce(p_snapshot, '{}'::jsonb)
  );
end;
$$;

create or replace function public.planner_record_entity_version(
  p_entity_type text,
  p_entity_id text,
  p_workspace_root_id uuid,
  p_version_number integer,
  p_change_type text,
  p_snapshot jsonb,
  p_actor_profile_id uuid,
  p_change_set_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  version_table text;
  inserted_id uuid;
begin
  version_table := case p_entity_type
    when 'athlete' then 'athlete_versions'
    when 'team' then 'team_versions'
    when 'assignment' then 'athlete_team_assignment_versions'
    when 'planner-project' then 'planner_project_versions'
    when 'evaluation' then 'planner_evaluation_versions'
    when 'skill-plan' then 'team_skill_plan_versions'
    when 'routine-plan' then 'team_routine_plan_versions'
    when 'season-plan' then 'team_season_plan_versions'
    else null
  end;

  if version_table is null then
    raise exception 'UNSUPPORTED_ENTITY_TYPE';
  end if;

  execute format(
    'insert into public.%I (
      entity_id,
      workspace_root_id,
      version_number,
      change_type,
      snapshot,
      changed_by_profile_id,
      change_set_id
    ) values ($1, $2, $3, $4, $5, $6, $7)
    returning id',
    version_table
  )
  into inserted_id
  using
    p_entity_id,
    p_workspace_root_id,
    p_version_number,
    p_change_type,
    coalesce(p_snapshot, '{}'::jsonb),
    p_actor_profile_id,
    p_change_set_id;

  perform public.planner_record_change_event(
    p_workspace_root_id,
    p_change_set_id,
    p_entity_type,
    p_entity_id,
    p_change_type,
    version_table,
    inserted_id,
    p_snapshot
  );

  return inserted_id;
end;
$$;

create or replace function public.planner_create_workspace_backup(
  p_workspace_root_id uuid,
  p_backup_type text,
  p_triggered_by_profile_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  backup_snapshot jsonb;
  backup_id uuid;
begin
  select jsonb_build_object(
    'workspaceRoot', (
      select row_to_json(wr)::jsonb
      from public.workspace_roots wr
      where wr.id = p_workspace_root_id
    ),
    'plannerProject', coalesce((
      select row_to_json(pp)::jsonb
      from public.planner_projects pp
      where pp.workspace_root_id = p_workspace_root_id
        and pp.deleted_at is null
      order by pp.updated_at desc
      limit 1
    ), '{}'::jsonb),
    'athletes', coalesce((
      select jsonb_agg(row_to_json(a)::jsonb order by a.created_at asc)
      from public.athletes a
      where a.workspace_root_id = p_workspace_root_id
        and a.deleted_at is null
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(row_to_json(t)::jsonb order by t.created_at asc)
      from public.teams t
      where t.workspace_root_id = p_workspace_root_id
        and t.deleted_at is null
    ), '[]'::jsonb),
    'teamCoaches', coalesce((
      select jsonb_agg(row_to_json(tc)::jsonb order by tc.created_at asc)
      from public.team_coaches tc
      where exists (
        select 1
        from public.teams t
        where t.id = tc.team_id
          and t.workspace_root_id = p_workspace_root_id
          and t.deleted_at is null
      )
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(row_to_json(ata)::jsonb order by ata.created_at asc)
      from public.athlete_team_assignments ata
      where ata.workspace_root_id = p_workspace_root_id
        and ata.deleted_at is null
    ), '[]'::jsonb),
    'evaluations', coalesce((
      select jsonb_agg(row_to_json(pe)::jsonb order by pe.created_at asc)
      from public.planner_evaluations pe
      where pe.workspace_root_id = p_workspace_root_id
        and pe.deleted_at is null
    ), '[]'::jsonb),
    'skillPlans', coalesce((
      select jsonb_agg(row_to_json(sp)::jsonb order by sp.created_at asc)
      from public.team_skill_plans sp
      where sp.workspace_root_id = p_workspace_root_id
        and sp.deleted_at is null
    ), '[]'::jsonb),
    'routinePlans', coalesce((
      select jsonb_agg(row_to_json(rp)::jsonb order by rp.created_at asc)
      from public.team_routine_plans rp
      where rp.workspace_root_id = p_workspace_root_id
        and rp.deleted_at is null
    ), '[]'::jsonb),
    'seasonPlans', coalesce((
      select jsonb_agg(row_to_json(sep)::jsonb order by sep.created_at asc)
      from public.team_season_plans sep
      where sep.workspace_root_id = p_workspace_root_id
        and sep.deleted_at is null
    ), '[]'::jsonb)
  )
  into backup_snapshot;

  insert into public.workspace_backups (
    workspace_root_id,
    backup_type,
    status,
    snapshot,
    metadata,
    triggered_by_profile_id,
    expires_at
  )
  values (
    p_workspace_root_id,
    p_backup_type,
    'ready',
    coalesce(backup_snapshot, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb),
    p_triggered_by_profile_id,
    case
      when p_backup_type = 'scheduled-nightly' then timezone('utc'::text, now()) + interval '365 days'
      else timezone('utc'::text, now()) + interval '30 days'
    end
  )
  returning id
  into backup_id;

  return backup_id;
end;
$$;

create or replace function public.planner_run_workspace_backup_cycle(
  p_backup_type text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  root_row record;
  backup_count integer := 0;
begin
  for root_row in
    select id
    from public.workspace_roots
    where status = 'active'
  loop
    perform public.planner_create_workspace_backup(root_row.id, p_backup_type, null, jsonb_build_object('scheduled', true));
    backup_count := backup_count + 1;
  end loop;

  return backup_count;
end;
$$;

create or replace function public.planner_ensure_project_row(
  p_workspace_root_id uuid
)
returns public.planner_projects
language plpgsql
security definer
set search_path = public
as $$
declare
  root_row public.workspace_roots;
  project_row public.planner_projects;
begin
  select *
  into root_row
  from public.workspace_roots
  where id = p_workspace_root_id;

  if root_row.id is null then
    raise exception 'WORKSPACE_ROOT_NOT_FOUND';
  end if;

  select *
  into project_row
  from public.planner_projects pp
  where pp.workspace_root_id = p_workspace_root_id
    and pp.deleted_at is null
  limit 1;

  if project_row.id is null then
    insert into public.planner_projects (
      id,
      workspace_root_id,
      scope_type,
      owner_profile_id,
      gym_id,
      name,
      status,
      pipeline_stage,
      template,
      qualification_rules,
      lock_version
    )
    values (
      'planner-project:' || p_workspace_root_id::text,
      p_workspace_root_id,
      root_row.scope_type,
      root_row.owner_profile_id,
      root_row.gym_id,
      'Cheer Planner',
      'active',
      'tryouts',
      '{}'::jsonb,
      '{}'::jsonb,
      1
    )
    returning *
    into project_row;
  end if;

  return project_row;
end;
$$;

create or replace function public.planner_touch_project_activity(
  p_project_id text,
  p_change_set_id uuid
)
returns public.planner_projects
language plpgsql
security definer
set search_path = public
as $$
declare
  next_row public.planner_projects;
begin
  update public.planner_projects
  set
    last_change_set_id = p_change_set_id,
    updated_at = timezone('utc'::text, now())
  where id = p_project_id
  returning *
  into next_row;

  return next_row;
end;
$$;

create or replace function public.planner_raise_conflict(
  p_message text
)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_message
    using errcode = 'P0001';
end;
$$;

create or replace function public.planner_entity_current_table(
  p_entity_type text
)
returns text
language sql
immutable
as $$
  select case p_entity_type
    when 'athlete' then 'athletes'
    when 'team' then 'teams'
    when 'assignment' then 'athlete_team_assignments'
    when 'planner-project' then 'planner_projects'
    when 'evaluation' then 'planner_evaluations'
    when 'skill-plan' then 'team_skill_plans'
    when 'routine-plan' then 'team_routine_plans'
    when 'season-plan' then 'team_season_plans'
    else null
  end;
$$;

create or replace function public.planner_restore_snapshot_row(
  p_entity_type text,
  p_snapshot jsonb,
  p_workspace_root_id uuid,
  p_actor_profile_id uuid,
  p_change_set_id uuid,
  p_restored_from_version_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_table text;
  insert_columns text;
  update_columns text;
  row_snapshot jsonb;
begin
  current_table := public.planner_entity_current_table(p_entity_type);

  if current_table is null then
    raise exception 'UNSUPPORTED_ENTITY_TYPE';
  end if;

  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
  into insert_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = current_table;

  select string_agg(
    format('%1$s = excluded.%1$s', quote_ident(column_name)),
    ', ' order by ordinal_position
  )
  into update_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = current_table
    and column_name <> 'id';

  execute format(
    $sql$
      with incoming as (
        select *
        from jsonb_populate_record(null::public.%1$I, $1)
      ),
      normalized as (
        select
          incoming.*,
          $2::uuid as workspace_root_id,
          coalesce((
            select lock_version + 1
            from public.%1$I current_row
            where current_row.id = incoming.id
          ), 1) as lock_version,
          timezone('utc'::text, now()) as updated_at,
          null::timestamptz as deleted_at,
          null::uuid as deleted_by_profile_id,
          $3::uuid as restored_from_version_id,
          $4::uuid as last_change_set_id
        from incoming
      ),
      upserted as (
        insert into public.%1$I (%2$s)
        select %2$s
        from normalized
        on conflict (id) do update
        set %3$s
        returning row_to_json(%1$I.*)::jsonb
      )
      select *
      from upserted
    $sql$,
    current_table,
    insert_columns,
    update_columns
  )
  into row_snapshot
  using p_snapshot, p_workspace_root_id, p_restored_from_version_id, p_change_set_id;

  if row_snapshot is null then
    raise exception 'RESTORE_FAILED';
  end if;

  return row_snapshot;
end;
$$;

create or replace function public.planner_soft_delete_team(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_expected_lock_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_team public.teams;
  updated_team public.teams;
  change_set_id uuid;
  version_id uuid;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into current_team
  from public.teams
  where id = p_team_id
    and workspace_root_id = p_workspace_root_id
    and deleted_at is null;

  if current_team.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  if p_expected_lock_version is not null and current_team.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  perform public.planner_create_workspace_backup(
    p_workspace_root_id,
    'pre-destructive',
    p_actor_profile_id,
    jsonb_build_object('entityType', 'team', 'entityId', p_team_id)
  );

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'team-delete',
    'Soft delete team',
    jsonb_build_object('teamId', p_team_id)
  );

  update public.teams
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = current_team.lock_version + 1
  where id = p_team_id
  returning *
  into updated_team;

  update public.athlete_team_assignments
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = lock_version + 1
  where team_id = p_team_id
    and deleted_at is null;

  update public.team_skill_plans
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = lock_version + 1
  where team_id = p_team_id
    and deleted_at is null;

  update public.team_routine_plans
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = lock_version + 1
  where team_id = p_team_id
    and deleted_at is null;

  update public.team_season_plans
  set
    deleted_at = timezone('utc'::text, now()),
    deleted_by_profile_id = p_actor_profile_id,
    last_change_set_id = change_set_id,
    lock_version = lock_version + 1
  where team_id = p_team_id
    and deleted_at is null;

  version_id := public.planner_record_entity_version(
    'team',
    updated_team.id::text,
    p_workspace_root_id,
    updated_team.lock_version,
    'delete',
    row_to_json(updated_team)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', row_to_json(updated_team)::jsonb,
    'lockVersion', updated_team.lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', updated_team.lock_version,
    'versionId', version_id
  );
end;
$$;

create or replace function public.planner_command_project_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_expected_lock_version integer default null,
  p_name text default null,
  p_status text default null,
  p_pipeline_stage text default null,
  p_template jsonb default null,
  p_qualification_rules jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.planner_projects;
  next_row public.planner_projects;
  change_set_id uuid;
  version_id uuid;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  current_row := public.planner_ensure_project_row(p_workspace_root_id);

  if p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'project-save',
    'Save planner project configuration',
    jsonb_build_object('projectId', current_row.id)
  );

  update public.planner_projects
  set
    name = coalesce(nullif(trim(p_name), ''), current_row.name),
    status = coalesce(nullif(trim(p_status), ''), current_row.status),
    pipeline_stage = coalesce(nullif(trim(p_pipeline_stage), ''), current_row.pipeline_stage),
    template = coalesce(p_template, current_row.template),
    qualification_rules = coalesce(p_qualification_rules, current_row.qualification_rules),
    last_change_set_id = change_set_id,
    lock_version = current_row.lock_version + 1,
    deleted_at = null,
    deleted_by_profile_id = null,
    restored_from_version_id = null
  where id = current_row.id
  returning *
  into next_row;

  version_id := public.planner_record_entity_version(
    'planner-project',
    next_row.id,
    p_workspace_root_id,
    next_row.lock_version,
    case when current_row.lock_version = 1 and current_row.last_change_set_id is null then 'create' else 'update' end,
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

create or replace function public.planner_command_athlete_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_expected_lock_version integer default null,
  p_athlete_id uuid default null,
  p_first_name text default null,
  p_last_name text default null,
  p_birth_date date default null,
  p_registration_number text default null,
  p_notes text default '',
  p_parent_contacts jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  root_row public.workspace_roots;
  current_row public.athletes;
  next_row public.athletes;
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

  if p_athlete_id is not null then
    select *
    into current_row
    from public.athletes
    where id = p_athlete_id
      and workspace_root_id = p_workspace_root_id;
  elsif nullif(trim(coalesce(p_registration_number, '')), '') is not null then
    select *
    into current_row
    from public.athletes
    where workspace_root_id = p_workspace_root_id
      and registration_number = trim(p_registration_number)
    limit 1;
  end if;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  if current_row.id is null and (nullif(trim(coalesce(p_first_name, '')), '') is null or nullif(trim(coalesce(p_last_name, '')), '') is null) then
    raise exception 'ATHLETE_NAME_REQUIRED';
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'athlete-save',
    'Save athlete',
    jsonb_build_object('athleteId', coalesce(current_row.id, p_athlete_id))
  );

  if current_row.id is null then
    insert into public.athletes (
      workspace_root_id,
      gym_id,
      created_by_profile_id,
      first_name,
      last_name,
      birth_date,
      registration_number,
      notes,
      parent_contacts,
      metadata,
      lock_version,
      last_change_set_id
    )
    values (
      p_workspace_root_id,
      case when root_row.scope_type = 'gym' then root_row.gym_id else null end,
      p_actor_profile_id,
      trim(p_first_name),
      trim(p_last_name),
      p_birth_date,
      nullif(trim(coalesce(p_registration_number, '')), ''),
      coalesce(p_notes, ''),
      coalesce(p_parent_contacts, '[]'::jsonb),
      jsonb_build_object(
        'registrationNumber', nullif(trim(coalesce(p_registration_number, '')), ''),
        'notes', coalesce(p_notes, ''),
        'parentContacts', coalesce(p_parent_contacts, '[]'::jsonb),
        'createdByProfileId', p_actor_profile_id
      ),
      1,
      change_set_id
    )
    returning *
    into next_row;

    change_type := 'create';
  else
    update public.athletes
    set
      first_name = coalesce(nullif(trim(p_first_name), ''), current_row.first_name),
      last_name = coalesce(nullif(trim(p_last_name), ''), current_row.last_name),
      birth_date = coalesce(p_birth_date, current_row.birth_date),
      registration_number = coalesce(nullif(trim(p_registration_number), ''), current_row.registration_number),
      notes = coalesce(p_notes, current_row.notes),
      parent_contacts = coalesce(p_parent_contacts, current_row.parent_contacts),
      metadata = jsonb_build_object(
        'registrationNumber', coalesce(nullif(trim(p_registration_number), ''), current_row.registration_number),
        'notes', coalesce(p_notes, current_row.notes),
        'parentContacts', coalesce(p_parent_contacts, current_row.parent_contacts),
        'createdByProfileId', coalesce(current_row.created_by_profile_id, p_actor_profile_id)
      ),
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

  version_id := public.planner_record_entity_version(
    'athlete',
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

create or replace function public.planner_command_evaluation_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_evaluation_id text,
  p_athlete_id uuid,
  p_expected_lock_version integer default null,
  p_occurred_at timestamptz default null,
  p_record jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.planner_evaluations;
  next_row public.planner_evaluations;
  athlete_row public.athletes;
  project_row public.planner_projects;
  touched_project_row public.planner_projects;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into athlete_row
  from public.athletes
  where id = p_athlete_id
    and workspace_root_id = p_workspace_root_id
    and deleted_at is null;

  if athlete_row.id is null then
    raise exception 'ATHLETE_NOT_FOUND';
  end if;

  select *
  into current_row
  from public.planner_evaluations
  where id = p_evaluation_id
    and workspace_root_id = p_workspace_root_id;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  project_row := public.planner_ensure_project_row(p_workspace_root_id);

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'evaluation-save',
    'Save planner evaluation',
    jsonb_build_object('evaluationId', p_evaluation_id, 'athleteId', p_athlete_id)
  );

  if current_row.id is null then
    insert into public.planner_evaluations (
      id,
      workspace_root_id,
      planner_project_id,
      athlete_id,
      occurred_at,
      record,
      lock_version,
      last_change_set_id
    )
    values (
      p_evaluation_id,
      p_workspace_root_id,
      project_row.id,
      p_athlete_id,
      p_occurred_at,
      coalesce(p_record, '{}'::jsonb),
      1,
      change_set_id
    )
    returning *
    into next_row;

    change_type := 'create';
  else
    update public.planner_evaluations
    set
      athlete_id = p_athlete_id,
      occurred_at = p_occurred_at,
      record = coalesce(p_record, current_row.record),
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

  touched_project_row := public.planner_touch_project_activity(project_row.id, change_set_id);

  version_id := public.planner_record_entity_version(
    'evaluation',
    next_row.id,
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
  p_assigned_coach_names text[] default '{}'::text[]
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
      ),
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
      metadata = jsonb_build_object(
        'teamLevel', coalesce(nullif(trim(p_team_level), ''), current_row.metadata ->> 'teamLevel', 'Beginner'),
        'ageCategory', coalesce(nullif(trim(p_team_type), ''), current_row.metadata ->> 'ageCategory', 'Youth'),
        'trainingDays', coalesce(p_training_days, current_row.metadata ->> 'trainingDays', ''),
        'trainingHours', coalesce(p_training_hours, current_row.metadata ->> 'trainingHours', ''),
        'assignedCoachNames', coalesce(to_jsonb(p_assigned_coach_names), current_row.metadata -> 'assignedCoachNames', '[]'::jsonb),
        'linkedCoachIds', coalesce(to_jsonb(p_linked_coach_ids), current_row.metadata -> 'linkedCoachIds', '[]'::jsonb)
      ),
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

create or replace function public.planner_command_team_assignments_set(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_athlete_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  team_row public.teams;
  version_id uuid;
  change_set_id uuid;
  athlete_row record;
  assignment_row public.athlete_team_assignments;
  desired_athlete_id uuid;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into team_row
  from public.teams
  where id = p_team_id
    and workspace_root_id = p_workspace_root_id
    and deleted_at is null;

  if team_row.id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'team-assignments-set',
    'Replace team assignments',
    jsonb_build_object('teamId', p_team_id, 'athleteIds', p_athlete_ids)
  );

  for athlete_row in
    select *
    from public.athlete_team_assignments ata
    where ata.workspace_root_id = p_workspace_root_id
      and ata.team_id = p_team_id
      and ata.deleted_at is null
  loop
    if not athlete_row.athlete_id = any (p_athlete_ids) then
      update public.athlete_team_assignments
      set
        deleted_at = timezone('utc'::text, now()),
        deleted_by_profile_id = p_actor_profile_id,
        last_change_set_id = change_set_id,
        lock_version = athlete_row.lock_version + 1
      where id = athlete_row.id;

      perform public.planner_record_entity_version(
        'assignment',
        athlete_row.id::text,
        p_workspace_root_id,
        athlete_row.lock_version + 1,
        'delete',
        (select row_to_json(ata)::jsonb from public.athlete_team_assignments ata where ata.id = athlete_row.id),
        p_actor_profile_id,
        change_set_id
      );
    end if;
  end loop;

  foreach desired_athlete_id in array p_athlete_ids loop
    if not exists (
      select 1
      from public.athletes a
      where a.id = desired_athlete_id
        and a.workspace_root_id = p_workspace_root_id
        and a.deleted_at is null
    ) then
      raise exception 'ATHLETE_NOT_FOUND';
    end if;

    select *
    into assignment_row
    from public.athlete_team_assignments ata
    where ata.athlete_id = desired_athlete_id
      and ata.team_id = p_team_id
      and ata.workspace_root_id = p_workspace_root_id
    limit 1;

    if assignment_row.id is null then
      insert into public.athlete_team_assignments (
        workspace_root_id,
        athlete_id,
        team_id,
        lock_version,
        last_change_set_id
      )
      values (
        p_workspace_root_id,
        desired_athlete_id,
        p_team_id,
        1,
        change_set_id
      )
      returning *
      into assignment_row;

      perform public.planner_record_entity_version(
        'assignment',
        assignment_row.id::text,
        p_workspace_root_id,
        assignment_row.lock_version,
        'create',
        row_to_json(assignment_row)::jsonb,
        p_actor_profile_id,
        change_set_id
      );
    elsif assignment_row.deleted_at is not null then
      update public.athlete_team_assignments
      set
        deleted_at = null,
        deleted_by_profile_id = null,
        restored_from_version_id = null,
        last_change_set_id = change_set_id,
        lock_version = assignment_row.lock_version + 1
      where id = assignment_row.id
      returning *
      into assignment_row;

      perform public.planner_record_entity_version(
        'assignment',
        assignment_row.id::text,
        p_workspace_root_id,
        assignment_row.lock_version,
        'restore',
        row_to_json(assignment_row)::jsonb,
        p_actor_profile_id,
        change_set_id
      );
    end if;
  end loop;

  update public.teams
  set
    last_change_set_id = change_set_id,
    updated_at = timezone('utc'::text, now()),
    lock_version = team_row.lock_version + 1
  where id = p_team_id
  returning *
  into team_row;

  version_id := public.planner_record_entity_version(
    'team',
    team_row.id::text,
    p_workspace_root_id,
    team_row.lock_version,
    'update',
    row_to_json(team_row)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', row_to_json(team_row)::jsonb,
    'lockVersion', team_row.lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', team_row.lock_version,
    'versionId', version_id
  );
end;
$$;

create or replace function public.planner_command_skill_plan_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_expected_lock_version integer default null,
  p_status text default 'draft',
  p_notes text default '',
  p_selections jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row public.planner_projects;
  current_row public.team_skill_plans;
  next_row public.team_skill_plans;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  project_row := public.planner_ensure_project_row(p_workspace_root_id);

  select *
  into current_row
  from public.team_skill_plans
  where planner_project_id = project_row.id
    and team_id = p_team_id;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'skill-plan-save',
    'Save skill plan',
    jsonb_build_object('teamId', p_team_id)
  );

  insert into public.team_skill_plans (
    id,
    workspace_root_id,
    planner_project_id,
    team_id,
    status,
    notes,
    selections,
    lock_version,
    last_change_set_id,
    deleted_at,
    deleted_by_profile_id,
    restored_from_version_id
  )
  values (
    coalesce(current_row.id, gen_random_uuid()),
    p_workspace_root_id,
    project_row.id,
    p_team_id,
    coalesce(nullif(trim(p_status), ''), 'draft'),
    coalesce(p_notes, ''),
    coalesce(p_selections, '[]'::jsonb),
    case when current_row.id is null then 1 else current_row.lock_version + 1 end,
    change_set_id,
    null,
    null,
    null
  )
  on conflict (planner_project_id, team_id) do update
  set
    status = excluded.status,
    notes = excluded.notes,
    selections = excluded.selections,
    workspace_root_id = excluded.workspace_root_id,
    last_change_set_id = excluded.last_change_set_id,
    deleted_at = null,
    deleted_by_profile_id = null,
    restored_from_version_id = null,
    lock_version = case when current_row.id is null then public.team_skill_plans.lock_version + 1 else excluded.lock_version end
  returning *
  into next_row;

  change_type := case
    when current_row.id is null then 'create'
    when current_row.deleted_at is not null then 'restore'
    else 'update'
  end;

  version_id := public.planner_record_entity_version(
    'skill-plan',
    next_row.id::text,
    p_workspace_root_id,
    next_row.lock_version,
    change_type,
    row_to_json(next_row)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object('entity', row_to_json(next_row)::jsonb, 'lockVersion', next_row.lock_version, 'changeSetId', change_set_id, 'latestVersionNumber', next_row.lock_version, 'versionId', version_id);
end;
$$;

create or replace function public.planner_command_routine_plan_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_expected_lock_version integer default null,
  p_status text default 'draft',
  p_notes text default '',
  p_document jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row public.planner_projects;
  current_row public.team_routine_plans;
  next_row public.team_routine_plans;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  project_row := public.planner_ensure_project_row(p_workspace_root_id);

  select *
  into current_row
  from public.team_routine_plans
  where planner_project_id = project_row.id
    and team_id = p_team_id;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'routine-plan-save',
    'Save routine plan',
    jsonb_build_object('teamId', p_team_id)
  );

  insert into public.team_routine_plans (
    id,
    workspace_root_id,
    planner_project_id,
    team_id,
    status,
    notes,
    document,
    lock_version,
    last_change_set_id,
    deleted_at,
    deleted_by_profile_id,
    restored_from_version_id
  )
  values (
    coalesce(current_row.id, gen_random_uuid()),
    p_workspace_root_id,
    project_row.id,
    p_team_id,
    coalesce(nullif(trim(p_status), ''), 'draft'),
    coalesce(p_notes, ''),
    coalesce(p_document, '{}'::jsonb),
    case when current_row.id is null then 1 else current_row.lock_version + 1 end,
    change_set_id,
    null,
    null,
    null
  )
  on conflict (planner_project_id, team_id) do update
  set
    status = excluded.status,
    notes = excluded.notes,
    document = excluded.document,
    workspace_root_id = excluded.workspace_root_id,
    last_change_set_id = excluded.last_change_set_id,
    deleted_at = null,
    deleted_by_profile_id = null,
    restored_from_version_id = null,
    lock_version = case when current_row.id is null then public.team_routine_plans.lock_version + 1 else excluded.lock_version end
  returning *
  into next_row;

  change_type := case
    when current_row.id is null then 'create'
    when current_row.deleted_at is not null then 'restore'
    else 'update'
  end;

  version_id := public.planner_record_entity_version(
    'routine-plan',
    next_row.id::text,
    p_workspace_root_id,
    next_row.lock_version,
    change_type,
    row_to_json(next_row)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object('entity', row_to_json(next_row)::jsonb, 'lockVersion', next_row.lock_version, 'changeSetId', change_set_id, 'latestVersionNumber', next_row.lock_version, 'versionId', version_id);
end;
$$;

create or replace function public.planner_command_season_plan_save(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_team_id uuid,
  p_expected_lock_version integer default null,
  p_status text default 'draft',
  p_notes text default '',
  p_checkpoints jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  project_row public.planner_projects;
  current_row public.team_season_plans;
  next_row public.team_season_plans;
  change_set_id uuid;
  version_id uuid;
  change_type text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'write') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  project_row := public.planner_ensure_project_row(p_workspace_root_id);

  select *
  into current_row
  from public.team_season_plans
  where planner_project_id = project_row.id
    and team_id = p_team_id;

  if current_row.id is not null and p_expected_lock_version is not null and current_row.lock_version <> p_expected_lock_version then
    perform public.planner_raise_conflict('PLANNER_CONFLICT');
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'season-plan-save',
    'Save season plan',
    jsonb_build_object('teamId', p_team_id)
  );

  insert into public.team_season_plans (
    id,
    workspace_root_id,
    planner_project_id,
    team_id,
    status,
    notes,
    checkpoints,
    lock_version,
    last_change_set_id,
    deleted_at,
    deleted_by_profile_id,
    restored_from_version_id
  )
  values (
    coalesce(current_row.id, gen_random_uuid()),
    p_workspace_root_id,
    project_row.id,
    p_team_id,
    coalesce(nullif(trim(p_status), ''), 'draft'),
    coalesce(p_notes, ''),
    coalesce(p_checkpoints, '[]'::jsonb),
    case when current_row.id is null then 1 else current_row.lock_version + 1 end,
    change_set_id,
    null,
    null,
    null
  )
  on conflict (planner_project_id, team_id) do update
  set
    status = excluded.status,
    notes = excluded.notes,
    checkpoints = excluded.checkpoints,
    workspace_root_id = excluded.workspace_root_id,
    last_change_set_id = excluded.last_change_set_id,
    deleted_at = null,
    deleted_by_profile_id = null,
    restored_from_version_id = null,
    lock_version = case when current_row.id is null then public.team_season_plans.lock_version + 1 else excluded.lock_version end
  returning *
  into next_row;

  change_type := case
    when current_row.id is null then 'create'
    when current_row.deleted_at is not null then 'restore'
    else 'update'
  end;

  version_id := public.planner_record_entity_version(
    'season-plan',
    next_row.id::text,
    p_workspace_root_id,
    next_row.lock_version,
    change_type,
    row_to_json(next_row)::jsonb,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object('entity', row_to_json(next_row)::jsonb, 'lockVersion', next_row.lock_version, 'changeSetId', change_set_id, 'latestVersionNumber', next_row.lock_version, 'versionId', version_id);
end;
$$;

create or replace function public.planner_command_entity_restore(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_entity_type text,
  p_version_id uuid,
  p_expected_lock_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  version_row record;
  restored_snapshot jsonb;
  restored_lock_version integer;
  change_set_id uuid;
  new_version_id uuid;
  current_table text;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'restore') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into version_row
  from public.workspace_entity_versions
  where id = p_version_id
    and entity_type = p_entity_type
    and workspace_root_id = p_workspace_root_id;

  if version_row.id is null then
    raise exception 'VERSION_NOT_FOUND';
  end if;

  current_table := public.planner_entity_current_table(p_entity_type);

  if p_expected_lock_version is not null then
    execute format('select lock_version from public.%I where id::text = $1', current_table)
    into restored_lock_version
    using version_row.entity_id;

    if restored_lock_version is not null and restored_lock_version <> p_expected_lock_version then
      perform public.planner_raise_conflict('PLANNER_CONFLICT');
    end if;
  end if;

  perform public.planner_create_workspace_backup(
    p_workspace_root_id,
    'pre-destructive',
    p_actor_profile_id,
    jsonb_build_object('entityType', p_entity_type, 'versionId', p_version_id)
  );

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'entity-restore',
    'Restore entity version',
    jsonb_build_object('entityType', p_entity_type, 'versionId', p_version_id)
  );

  restored_snapshot := public.planner_restore_snapshot_row(
    p_entity_type,
    version_row.snapshot,
    p_workspace_root_id,
    p_actor_profile_id,
    change_set_id,
    p_version_id
  );

  restored_lock_version := coalesce((restored_snapshot ->> 'lock_version')::integer, 1);

  new_version_id := public.planner_record_entity_version(
    p_entity_type,
    version_row.entity_id,
    p_workspace_root_id,
    restored_lock_version,
    'restore',
    restored_snapshot,
    p_actor_profile_id,
    change_set_id
  );

  return jsonb_build_object(
    'entity', restored_snapshot,
    'lockVersion', restored_lock_version,
    'changeSetId', change_set_id,
    'latestVersionNumber', restored_lock_version,
    'versionId', new_version_id
  );
end;
$$;

create or replace function public.planner_command_workspace_restore(
  p_actor_profile_id uuid,
  p_workspace_root_id uuid,
  p_backup_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  backup_row public.workspace_backups;
  change_set_id uuid;
  snapshot_row jsonb;
begin
  if not public.planner_workspace_root_can_access(p_actor_profile_id, p_workspace_root_id, 'restore') then
    raise exception 'WORKSPACE_ACCESS_DENIED';
  end if;

  select *
  into backup_row
  from public.workspace_backups
  where id = p_backup_id
    and workspace_root_id = p_workspace_root_id;

  if backup_row.id is null then
    raise exception 'BACKUP_NOT_FOUND';
  end if;

  change_set_id := public.planner_create_change_set(
    p_workspace_root_id,
    p_actor_profile_id,
    'workspace-restore',
    'Restore workspace backup',
    jsonb_build_object('backupId', p_backup_id)
  );

  if backup_row.snapshot ? 'plannerProject' then
    perform public.planner_restore_snapshot_row('planner-project', backup_row.snapshot -> 'plannerProject', p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end if;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'athletes', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('athlete', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'teams', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('team', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  delete from public.team_coaches
  where exists (
    select 1
    from public.teams t
    where t.id = public.team_coaches.team_id
      and t.workspace_root_id = p_workspace_root_id
  );

  insert into public.team_coaches
  select *
  from jsonb_populate_recordset(null::public.team_coaches, coalesce(backup_row.snapshot -> 'teamCoaches', '[]'::jsonb))
  on conflict (team_id, coach_profile_id) do update
  set role = excluded.role;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'assignments', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('assignment', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'evaluations', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('evaluation', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'skillPlans', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('skill-plan', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'routinePlans', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('routine-plan', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  for snapshot_row in select value from jsonb_array_elements(coalesce(backup_row.snapshot -> 'seasonPlans', '[]'::jsonb))
  loop
    perform public.planner_restore_snapshot_row('season-plan', snapshot_row, p_workspace_root_id, p_actor_profile_id, change_set_id, null);
  end loop;

  return jsonb_build_object(
    'workspaceRootId', p_workspace_root_id,
    'changeSetId', change_set_id,
    'backupId', p_backup_id
  );
end;
$$;

create or replace view public.workspace_entity_versions as
select 'athlete'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.athlete_versions
union all
select 'team'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_versions
union all
select 'assignment'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.athlete_team_assignment_versions
union all
select 'planner-project'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.planner_project_versions
union all
select 'evaluation'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.planner_evaluation_versions
union all
select 'skill-plan'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_skill_plan_versions
union all
select 'routine-plan'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_routine_plan_versions
union all
select 'season-plan'::text as entity_type, id, entity_id, workspace_root_id, version_number, change_type, snapshot, changed_by_profile_id, change_set_id, created_at
from public.team_season_plan_versions;

alter table public.workspace_roots enable row level security;
alter table public.workspace_change_sets enable row level security;
alter table public.workspace_change_events enable row level security;
alter table public.workspace_backups enable row level security;
alter table public.athlete_versions enable row level security;
alter table public.team_versions enable row level security;
alter table public.athlete_team_assignment_versions enable row level security;
alter table public.planner_project_versions enable row level security;
alter table public.planner_evaluation_versions enable row level security;
alter table public.team_skill_plan_versions enable row level security;
alter table public.team_routine_plan_versions enable row level security;
alter table public.team_season_plan_versions enable row level security;

drop policy if exists "workspace_roots_select_related" on public.workspace_roots;
create policy "workspace_roots_select_related"
  on public.workspace_roots for select
  using (public.planner_workspace_root_can_access(auth.uid(), id, 'read'));

drop policy if exists "workspace_change_sets_select_related" on public.workspace_change_sets;
create policy "workspace_change_sets_select_related"
  on public.workspace_change_sets for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "workspace_change_events_select_related" on public.workspace_change_events;
create policy "workspace_change_events_select_related"
  on public.workspace_change_events for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "workspace_backups_select_related" on public.workspace_backups;
create policy "workspace_backups_select_related"
  on public.workspace_backups for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'restore'));

drop policy if exists "athlete_versions_select_related" on public.athlete_versions;
create policy "athlete_versions_select_related"
  on public.athlete_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "team_versions_select_related" on public.team_versions;
create policy "team_versions_select_related"
  on public.team_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "assignment_versions_select_related" on public.athlete_team_assignment_versions;
create policy "assignment_versions_select_related"
  on public.athlete_team_assignment_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "project_versions_select_related" on public.planner_project_versions;
create policy "project_versions_select_related"
  on public.planner_project_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "evaluation_versions_select_related" on public.planner_evaluation_versions;
create policy "evaluation_versions_select_related"
  on public.planner_evaluation_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "skill_versions_select_related" on public.team_skill_plan_versions;
create policy "skill_versions_select_related"
  on public.team_skill_plan_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "routine_versions_select_related" on public.team_routine_plan_versions;
create policy "routine_versions_select_related"
  on public.team_routine_plan_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

drop policy if exists "season_versions_select_related" on public.team_season_plan_versions;
create policy "season_versions_select_related"
  on public.team_season_plan_versions for select
  using (public.planner_workspace_root_can_access(auth.uid(), workspace_root_id, 'read'));

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when undefined_file or insufficient_privilege then
      null;
  end;
end
$$;

do $planner_cron$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('planner_workspace_backup_6h');
    exception
      when others then null;
    end;

    begin
      perform cron.unschedule('planner_workspace_backup_nightly');
    exception
      when others then null;
    end;

    perform cron.schedule(
      'planner_workspace_backup_6h',
      '0 */6 * * *',
      'select public.planner_run_workspace_backup_cycle(''scheduled-6h'');'
    );

    perform cron.schedule(
      'planner_workspace_backup_nightly',
      '0 3 * * *',
      'select public.planner_run_workspace_backup_cycle(''scheduled-nightly'');'
    );
  end if;
end
$planner_cron$;
