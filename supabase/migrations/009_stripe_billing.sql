alter table public.profiles
  add column if not exists stripe_customer_id text unique;

alter table public.gyms
  add column if not exists stripe_customer_id text unique;

alter table public.membership_plans
  add column if not exists external_price_id text unique;

alter table public.user_memberships
  add column if not exists gym_id uuid references public.gyms(id) on delete cascade;

alter table public.user_memberships
  drop constraint if exists user_memberships_status_check;

alter table public.user_memberships
  add constraint user_memberships_status_check check (
    status in ('trialing', 'active', 'past_due', 'paused', 'canceled', 'expired', 'incomplete', 'unpaid')
  );

create index if not exists idx_user_memberships_gym_status
  on public.user_memberships (gym_id, status);

create index if not exists idx_user_memberships_provider_customer
  on public.user_memberships (provider_customer_id);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  processing_error text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.stripe_webhook_events enable row level security;

insert into public.membership_plans (code, name, description, provider, interval_label, active, metadata)
values (
  'premium',
  'Premium',
  'Unlock Cheer Planner editing and team record history.',
  'stripe',
  'subscription',
  true,
  '{"tier":"premium"}'::jsonb
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  provider = excluded.provider,
  interval_label = excluded.interval_label,
  active = true,
  metadata = public.membership_plans.metadata || excluded.metadata;

insert into public.tools (slug, name, description, icon_name, is_premium, status, sort_order, config)
values
  ('cheer-planner', 'Cheer Planner', 'Athlete-driven team planning, tryouts, routines, skills, and season plans.', 'calendar-check', true, 'active', 10, '{}'::jsonb),
  ('cheer-score-calculator', 'Cheer Score Calculator', 'Free scoring calculator. Saved team records require Premium.', 'calculator', false, 'active', 20, '{"premiumRecords":true}'::jsonb),
  ('full-out-evaluator', 'Full-out Evaluator', 'Free execution evaluator. Saved team records require Premium.', 'clipboard-check', false, 'active', 30, '{"premiumRecords":true}'::jsonb)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon_name = excluded.icon_name,
  is_premium = excluded.is_premium,
  status = excluded.status,
  sort_order = excluded.sort_order,
  config = public.tools.config || excluded.config;

insert into public.tool_access_rules (tool_id, membership_plan_id, access_tier)
select t.id, mp.id, 'premium'
from public.tools t
cross join public.membership_plans mp
where t.slug = 'cheer-planner'
  and mp.code = 'premium'
on conflict (tool_id, membership_plan_id) do update
set access_tier = excluded.access_tier;

create or replace function public.user_has_tool_access(
  p_user_id uuid,
  p_tool_slug text,
  p_scope_type text default null,
  p_gym_id uuid default null
)
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
  current_profile as (
    select id, primary_gym_id
    from public.profiles
    where id = p_user_id
  ),
  requested_gym as (
    select coalesce(p_gym_id, (select primary_gym_id from current_profile)) as gym_id
  ),
  eligible_memberships as (
    select um.membership_plan_id
    from public.user_memberships um
    where um.provider = 'stripe'
      and um.user_id = p_user_id
      and um.gym_id is null
      and um.status in ('trialing', 'active', 'past_due', 'canceled')
      and (
        um.current_period_end is null
        or um.current_period_end >= timezone('utc'::text, now())
      )

    union

    select um.membership_plan_id
    from public.user_memberships um
    join requested_gym rg on rg.gym_id = um.gym_id
    where coalesce(p_scope_type, 'coach') = 'gym'
      and um.provider = 'stripe'
      and um.gym_id is not null
      and um.status in ('trialing', 'active', 'past_due', 'canceled')
      and (
        um.current_period_end is null
        or um.current_period_end >= timezone('utc'::text, now())
      )
      and (
        exists (
          select 1
          from public.gyms g
          where g.id = um.gym_id
            and g.owner_profile_id = p_user_id
        )
        or exists (
          select 1
          from public.gym_coach_licenses gcl
          where gcl.gym_id = um.gym_id
            and gcl.coach_profile_id = p_user_id
            and gcl.status = 'active'
        )
      )

    union

    select um.membership_plan_id
    from public.user_memberships um
    where um.provider = 'manual'
      and um.user_id = p_user_id
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
      join eligible_memberships em on em.membership_plan_id = tar.membership_plan_id
      where tar.access_tier in ('premium', 'vip')
    ) then true
    else false
  end;
$$;
