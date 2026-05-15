begin;

create table if not exists public.usasf_age_category_grids (
  id uuid primary key default gen_random_uuid(),
  season_label text not null,
  label text not null,
  status text not null default 'draft',
  source_name text,
  notes text,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint usasf_age_category_grids_status_check check (status in ('draft', 'active', 'archived')),
  constraint usasf_age_category_grids_season_label_check check (length(trim(season_label)) > 0),
  constraint usasf_age_category_grids_label_check check (length(trim(label)) > 0)
);

create table if not exists public.usasf_age_category_rules (
  id uuid primary key default gen_random_uuid(),
  grid_id uuid not null references public.usasf_age_category_grids(id) on delete cascade,
  category_key text not null,
  category_name text not null,
  min_birth_year integer not null,
  max_birth_year integer not null,
  sort_order integer not null default 0,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint usasf_age_category_rules_status_check check (status in ('active', 'inactive')),
  constraint usasf_age_category_rules_key_check check (length(trim(category_key)) > 0),
  constraint usasf_age_category_rules_name_check check (length(trim(category_name)) > 0),
  constraint usasf_age_category_rules_year_range_check check (
    min_birth_year >= 1900
    and max_birth_year <= 2100
    and max_birth_year >= min_birth_year
  ),
  unique (grid_id, category_key)
);

create unique index if not exists idx_usasf_age_category_grids_one_active
  on public.usasf_age_category_grids (season_label)
  where status = 'active';

create index if not exists idx_usasf_age_category_grids_season_status
  on public.usasf_age_category_grids (season_label, status);

create index if not exists idx_usasf_age_category_rules_grid_sort
  on public.usasf_age_category_rules (grid_id, sort_order);

drop trigger if exists set_usasf_age_category_grids_updated_at on public.usasf_age_category_grids;
create trigger set_usasf_age_category_grids_updated_at
  before update on public.usasf_age_category_grids
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_usasf_age_category_rules_updated_at on public.usasf_age_category_rules;
create trigger set_usasf_age_category_rules_updated_at
  before update on public.usasf_age_category_rules
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.usasf_age_category_grids enable row level security;
alter table public.usasf_age_category_rules enable row level security;

drop policy if exists "usasf_age_category_grids_select_all" on public.usasf_age_category_grids;
create policy "usasf_age_category_grids_select_all"
  on public.usasf_age_category_grids for select
  using (true);

drop policy if exists "usasf_age_category_rules_select_all" on public.usasf_age_category_rules;
create policy "usasf_age_category_rules_select_all"
  on public.usasf_age_category_rules for select
  using (true);

drop policy if exists "usasf_age_category_grids_admin_write" on public.usasf_age_category_grids;
create policy "usasf_age_category_grids_admin_write"
  on public.usasf_age_category_grids for all
  using (public.planner_actor_is_admin(auth.uid()))
  with check (public.planner_actor_is_admin(auth.uid()));

drop policy if exists "usasf_age_category_rules_admin_write" on public.usasf_age_category_rules;
create policy "usasf_age_category_rules_admin_write"
  on public.usasf_age_category_rules for all
  using (public.planner_actor_is_admin(auth.uid()))
  with check (public.planner_actor_is_admin(auth.uid()));

commit;
