-- Skermtime — fas 11c: which app/game the child is using (live + per-day history).
alter table public.devices add column current_app text;
alter table public.devices add column current_app_at timestamptz;

create table public.app_usage (
  id        uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  child_id  uuid not null references public.child_profiles (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  app       text not null,
  day       date not null,
  seconds   integer not null default 0,
  unique (device_id, app, day)
);
create index app_usage_child_day_idx on public.app_usage (child_id, day);

alter table public.app_usage enable row level security;
create policy app_usage_select on public.app_usage
  for select to authenticated
  using (family_id in (select public.user_family_ids()));
grant all on public.app_usage to anon, authenticated, service_role;

-- Atomic accumulate of seconds for a (device, app, day).
create or replace function public.increment_app_usage(
  p_device uuid, p_child uuid, p_family uuid, p_app text, p_day date, p_seconds integer)
returns void
language sql
as $$
  insert into public.app_usage (device_id, child_id, family_id, app, day, seconds)
  values (p_device, p_child, p_family, p_app, p_day, p_seconds)
  on conflict (device_id, app, day)
    do update set seconds = public.app_usage.seconds + excluded.seconds;
$$;
grant execute on function public.increment_app_usage(uuid, uuid, uuid, text, date, integer)
  to anon, authenticated, service_role;
