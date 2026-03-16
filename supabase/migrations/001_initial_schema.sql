create extension if not exists "pgcrypto";

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  username text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  provider text not null default 'whop',
  external_product_id text unique,
  interval_label text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.user_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  membership_plan_id uuid references public.membership_plans(id) on delete set null,
  provider text not null default 'whop',
  provider_customer_id text,
  provider_membership_id text not null unique,
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint user_memberships_status_check check (
    status in ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired', 'incomplete')
  )
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  icon_name text,
  is_premium boolean not null default true,
  status text not null default 'draft',
  sort_order integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint tools_status_check check (status in ('draft', 'active', 'archived'))
);

create table if not exists public.tool_access_rules (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  membership_plan_id uuid references public.membership_plans(id) on delete cascade,
  access_tier text not null default 'premium',
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (tool_id, membership_plan_id),
  constraint tool_access_rules_tier_check check (access_tier in ('free', 'premium', 'vip'))
);

create table if not exists public.tool_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  status text not null default 'completed',
  input_data jsonb,
  output_data jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint tool_records_status_check check (status in ('queued', 'processing', 'completed', 'failed'))
);

create table if not exists public.whop_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'received',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint whop_webhook_events_status_check check (status in ('received', 'processed', 'failed'))
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.user_has_tool_access(p_user_id uuid, p_tool_slug text)
returns boolean
language sql
stable
as $$
  with selected_tool as (
    select id, is_premium
    from public.tools
    where slug = p_tool_slug
      and status = 'active'
  ),
  active_membership as (
    select um.membership_plan_id
    from public.user_memberships um
    where um.user_id = p_user_id
      and um.status in ('trialing', 'active')
      and (
        um.current_period_end is null
        or um.current_period_end >= timezone('utc'::text, now())
      )
  )
  select case
    when not exists (select 1 from selected_tool) then false
    when exists (select 1 from selected_tool where is_premium = false) then true
    when exists (
      select 1
      from selected_tool st
      join public.tool_access_rules tar on tar.tool_id = st.id
      left join active_membership am on am.membership_plan_id = tar.membership_plan_id
      where tar.access_tier in ('premium', 'vip')
        and (
          tar.membership_plan_id is null
          or am.membership_plan_id is not null
        )
    ) then true
    else false
  end;
$$;

create index if not exists idx_user_memberships_user_status
  on public.user_memberships (user_id, status);

create index if not exists idx_tools_status_sort
  on public.tools (status, sort_order);

create index if not exists idx_tool_records_user_tool_created
  on public.tool_records (user_id, tool_id, created_at desc);

create index if not exists idx_whop_webhook_events_status
  on public.whop_webhook_events (status, created_at desc);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_membership_plans_updated_at on public.membership_plans;
create trigger set_membership_plans_updated_at
  before update on public.membership_plans
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_user_memberships_updated_at on public.user_memberships;
create trigger set_user_memberships_updated_at
  before update on public.user_memberships
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_tools_updated_at on public.tools;
create trigger set_tools_updated_at
  before update on public.tools
  for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_tool_records_updated_at on public.tool_records;
create trigger set_tool_records_updated_at
  before update on public.tool_records
  for each row execute procedure public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;
alter table public.membership_plans enable row level security;
alter table public.user_memberships enable row level security;
alter table public.tools enable row level security;
alter table public.tool_access_rules enable row level security;
alter table public.tool_records enable row level security;
alter table public.whop_webhook_events enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "membership_plans_select_all" on public.membership_plans;
create policy "membership_plans_select_all"
  on public.membership_plans for select
  using (active = true);

drop policy if exists "user_memberships_select_own" on public.user_memberships;
create policy "user_memberships_select_own"
  on public.user_memberships for select
  using (auth.uid() = user_id);

drop policy if exists "tools_select_active" on public.tools;
create policy "tools_select_active"
  on public.tools for select
  using (status = 'active');

drop policy if exists "tool_access_rules_select_all" on public.tool_access_rules;
create policy "tool_access_rules_select_all"
  on public.tool_access_rules for select
  using (true);

drop policy if exists "tool_records_select_own" on public.tool_records;
create policy "tool_records_select_own"
  on public.tool_records for select
  using (auth.uid() = user_id);

drop policy if exists "tool_records_insert_own" on public.tool_records;
create policy "tool_records_insert_own"
  on public.tool_records for insert
  with check (auth.uid() = user_id);

drop policy if exists "tool_records_update_own" on public.tool_records;
create policy "tool_records_update_own"
  on public.tool_records for update
  using (auth.uid() = user_id);
