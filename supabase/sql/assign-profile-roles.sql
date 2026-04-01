-- Operational role reassignment helpers for existing authenticated users.
-- profiles.role remains the single persisted role source of truth.
-- Effective workspace access is derived in app runtime as:
-- coach -> coach
-- gym -> gym + coach
-- admin -> admin + gym + coach

-- Promote an existing user to gym access (gym + coach).
update public.profiles
set role = 'gym'
where email = 'user@example.com';

-- Promote an existing user to admin access (admin + gym + coach).
update public.profiles
set role = 'admin'
where email = 'user@example.com';

-- Restrict an existing user to coach access only.
update public.profiles
set role = 'coach'
where email = 'user@example.com';
