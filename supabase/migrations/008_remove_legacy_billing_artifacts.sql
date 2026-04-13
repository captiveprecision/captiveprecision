-- Remove the legacy provider-specific webhook event table. Billing is intentionally not connected in this phase.

drop table if exists public.whop_webhook_events;

alter table if exists public.membership_plans
  alter column provider set default 'manual';

alter table if exists public.user_memberships
  alter column provider set default 'manual';
