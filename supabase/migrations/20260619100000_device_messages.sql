-- Skermtime — fas 11b: parent → child's computer messages, shown on the overlay.
create table public.device_messages (
  id           uuid primary key default gen_random_uuid(),
  device_id    uuid not null references public.devices (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  child_id     uuid references public.child_profiles (id) on delete set null,
  body         text not null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  delivered_at timestamptz
);
create index device_messages_undelivered_idx
  on public.device_messages (device_id) where delivered_at is null;

alter table public.device_messages enable row level security;
create policy device_messages_all on public.device_messages
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

grant all on public.device_messages to anon, authenticated, service_role;
