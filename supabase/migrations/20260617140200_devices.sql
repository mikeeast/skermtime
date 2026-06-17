-- Skermtime — fas 3: device pairing for the Windows agent.
-- A device is paired to one child. The agent authenticates with a bearer token
-- whose SHA-256 hash is stored here; the agent API uses the service-role client
-- (bypassing RLS), while parents manage devices through normal family-scoped RLS.

create table public.devices (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  child_id        uuid not null references public.child_profiles (id) on delete cascade,
  name            text not null default 'PC',
  os              text,
  pairing_code    text,          -- 6-digit code while unpaired; null once paired
  code_expires_at timestamptz,
  token_hash      text,          -- sha256 hex of the device token
  paired          boolean not null default false,
  revoked         boolean not null default false,
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index devices_family_idx on public.devices (family_id);
create index devices_token_idx on public.devices (token_hash);
create unique index devices_pairing_code_idx
  on public.devices (pairing_code)
  where pairing_code is not null;

-- link tamper events to the device that reported them
alter table public.tamper_events
  add column device_id uuid references public.devices (id) on delete set null;

alter table public.devices enable row level security;

create policy devices_all on public.devices
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));
