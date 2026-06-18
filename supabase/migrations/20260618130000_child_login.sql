-- Child self-login: a short code the child types + a PIN the parent sets.
-- pin_hash already exists (nullable). login_code is generated per child; the
-- volatile default backfills existing rows with distinct codes too.
alter table public.child_profiles
  add column login_code text not null default upper(substr(md5(random()::text), 1, 6));

create unique index child_profiles_login_code_idx on public.child_profiles (login_code);
