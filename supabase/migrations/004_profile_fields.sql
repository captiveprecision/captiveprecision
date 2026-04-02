alter table public.profiles
  add column if not exists gym_name text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists role_label text,
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists teams_summary text;
