-- Apply this in the Supabase SQL Editor if the CLI is not available.
-- This is safe to rerun.
begin;

alter table public.gym_coach_licenses
  add column if not exists credential_levels jsonb not null default '[]'::jsonb;

commit;
