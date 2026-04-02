alter table public.profiles
  add column if not exists beta_access_status text not null default 'pending',
  add column if not exists beta_requested_at timestamptz,
  add column if not exists beta_reviewed_at timestamptz,
  add column if not exists beta_reviewed_by uuid references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_beta_access_status_check;
alter table public.profiles
  add constraint profiles_beta_access_status_check check (beta_access_status in ('pending', 'approved', 'rejected'));

update public.profiles
set
  beta_access_status = 'approved',
  beta_requested_at = coalesce(beta_requested_at, created_at),
  beta_reviewed_at = coalesce(beta_reviewed_at, updated_at)
where beta_access_status = 'pending';

create index if not exists idx_profiles_beta_access_status
  on public.profiles (beta_access_status, created_at desc);
