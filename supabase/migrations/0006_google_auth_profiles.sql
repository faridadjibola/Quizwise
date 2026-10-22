alter table public.profiles
  add column google_id text,
  add column avatar_url text,
  add column last_login_at timestamptz;

create unique index profiles_google_id_unique
  on public.profiles (google_id)
  where google_id is not null;
