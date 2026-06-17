-- Skermtime — fas 2: earning engine
-- Chores (shared library + custom), append-only ledger with cached balance,
-- chore completions + approval, Strava connection/activities, tamper bounty.
--
-- Design note: children are NOT auth users. All web mutations run as an
-- authenticated family member (parent, or child-mode within a family session),
-- so RLS is family-scoped. The agent (fas 3) uses a device token via a
-- service-authenticated path that bypasses these user policies.

-- ─────────────────────────────────────────────────────────────
-- Family earning settings
-- ─────────────────────────────────────────────────────────────
alter table public.families
  add column strava_minutes_per_km integer not null default 10,
  add column daily_cap_minutes integer; -- null = no daily cap

-- ─────────────────────────────────────────────────────────────
-- Chores: family_id NULL = system library row (readable by everyone)
-- ─────────────────────────────────────────────────────────────
create table public.chores (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid references public.families (id) on delete cascade,
  category        text not null,
  name            text not null,
  icon            text,
  reward_minutes  integer not null default 10 check (reward_minutes >= 0),
  frequency       text not null default 'asneeded'
                    check (frequency in ('daily', 'weekly', 'once', 'asneeded')),
  approval_mode   text not null default 'parent'
                    check (approval_mode in ('auto', 'parent', 'ai')),
  created_by_role text not null default 'parent'
                    check (created_by_role in ('parent', 'child', 'system')),
  created_by      uuid references auth.users (id) on delete set null,
  is_approved     boolean not null default true,  -- child-created rows start false
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index chores_family_id_idx on public.chores (family_id);

-- ─────────────────────────────────────────────────────────────
-- Ledger (append-only). Balance is cached on child_profiles via trigger.
-- ─────────────────────────────────────────────────────────────
create table public.ledger_entries (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.child_profiles (id) on delete cascade,
  delta_minutes integer not null,
  kind          text not null check (kind in
                  ('earn_chore', 'earn_strava', 'spend', 'adjust', 'bounty', 'clawback')),
  source_type   text,
  source_id     text,
  note          text,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index ledger_entries_child_idx on public.ledger_entries (child_id, created_at desc);

create or replace function public.apply_ledger_to_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.child_profiles
    set balance_minutes = balance_minutes + new.delta_minutes
    where id = new.child_id;
  return new;
end;
$$;

create trigger ledger_balance_after_insert
  after insert on public.ledger_entries
  for each row execute function public.apply_ledger_to_balance();

-- ─────────────────────────────────────────────────────────────
-- Chore completions: child marks done -> approval -> ledger earn
-- ─────────────────────────────────────────────────────────────
create table public.chore_completions (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  chore_id        uuid not null references public.chores (id) on delete cascade,
  child_id        uuid not null references public.child_profiles (id) on delete cascade,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'auto_approved', 'ai_approved')),
  minutes_awarded integer not null default 0,
  photo_before    text,
  photo_after     text,
  ai_verdict      jsonb,
  ledger_entry_id uuid references public.ledger_entries (id) on delete set null,
  decided_by      uuid references auth.users (id) on delete set null,
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index chore_completions_family_status_idx on public.chore_completions (family_id, status);
create index chore_completions_child_idx on public.chore_completions (child_id);

-- ─────────────────────────────────────────────────────────────
-- Strava connection (per child) + activities (dedupe + clawback)
-- ─────────────────────────────────────────────────────────────
create table public.strava_connections (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.child_profiles (id) on delete cascade unique,
  athlete_id    bigint not null,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  scope         text,
  created_at    timestamptz not null default now()
);
create index strava_connections_athlete_idx on public.strava_connections (athlete_id);

create table public.strava_activities (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references public.families (id) on delete cascade,
  child_id           uuid not null references public.child_profiles (id) on delete cascade,
  strava_activity_id bigint not null unique,
  type               text,
  distance_m         numeric,
  moving_time_s      integer,
  started_at         timestamptz,
  minutes_awarded    integer not null default 0,
  ledger_entry_id    uuid references public.ledger_entries (id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Tamper events -> bounty (we reward curiosity, not punish it)
-- ─────────────────────────────────────────────────────────────
create table public.tamper_events (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references public.families (id) on delete cascade,
  child_id      uuid not null references public.child_profiles (id) on delete cascade,
  type          text not null,
  detected_at   timestamptz not null default now(),
  bonus_minutes integer not null default 0,
  bonus_awarded boolean not null default false,
  writeup       text,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (all family-scoped; chores library readable by all)
-- ─────────────────────────────────────────────────────────────
alter table public.chores             enable row level security;
alter table public.ledger_entries     enable row level security;
alter table public.chore_completions  enable row level security;
alter table public.strava_connections enable row level security;
alter table public.strava_activities  enable row level security;
alter table public.tamper_events       enable row level security;

-- chores: read library + own family; mutate only own family rows
create policy chores_select on public.chores
  for select to authenticated
  using (family_id is null or family_id in (select public.user_family_ids()));
create policy chores_insert on public.chores
  for insert to authenticated
  with check (family_id in (select public.user_family_ids()));
create policy chores_update on public.chores
  for update to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));
create policy chores_delete on public.chores
  for delete to authenticated
  using (family_id in (select public.user_family_ids()));

-- ledger: append-only -> select + insert only (no update/delete policy)
create policy ledger_select on public.ledger_entries
  for select to authenticated
  using (family_id in (select public.user_family_ids()));
create policy ledger_insert on public.ledger_entries
  for insert to authenticated
  with check (family_id in (select public.user_family_ids()));

-- the remaining tables: full management by family members
create policy completions_all on public.chore_completions
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy strava_conn_all on public.strava_connections
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy strava_act_all on public.strava_activities
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy tamper_all on public.tamper_events
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

-- ─────────────────────────────────────────────────────────────
-- Seed: shared chore library (family_id NULL, system rows)
-- ─────────────────────────────────────────────────────────────
insert into public.chores (family_id, category, name, icon, reward_minutes, frequency, approval_mode, created_by_role) values
  (null, 'Kök',        'Duka / duka av',              '🍽️', 5,  'daily',    'auto',   'system'),
  (null, 'Kök',        'Tömma & fylla diskmaskinen',  '🧼', 10, 'daily',    'ai',     'system'),
  (null, 'Kök',        'Diska för hand',              '🧽', 10, 'asneeded', 'parent', 'system'),
  (null, 'Kök',        'Torka av bänkar & bord',      '🧴', 5,  'daily',    'auto',   'system'),
  (null, 'Kök',        'Laga en enklare måltid',      '🍳', 25, 'asneeded', 'parent', 'system'),
  (null, 'Kök',        'Ta ut sopor & återvinning',   '🗑️', 8,  'weekly',   'parent', 'system'),
  (null, 'Städning',   'Bädda sängen',                '🛏️', 3,  'daily',    'auto',   'system'),
  (null, 'Städning',   'Städa eget rum',              '🧹', 15, 'weekly',   'ai',     'system'),
  (null, 'Städning',   'Dammsuga ett rum',            '🌀', 10, 'asneeded', 'parent', 'system'),
  (null, 'Städning',   'Dammsuga hela våningen',      '🌀', 25, 'weekly',   'parent', 'system'),
  (null, 'Städning',   'Moppa golv',                  '🧼', 15, 'weekly',   'parent', 'system'),
  (null, 'Städning',   'Städa badrummet',             '🚿', 20, 'weekly',   'ai',     'system'),
  (null, 'Städning',   'Torka damm',                  '🪶', 10, 'weekly',   'parent', 'system'),
  (null, 'Tvätt',      'Starta en tvätt',             '🧺', 10, 'asneeded', 'parent', 'system'),
  (null, 'Tvätt',      'Hänga / ta in tvätt',         '🧷', 10, 'asneeded', 'parent', 'system'),
  (null, 'Tvätt',      'Vika & lägga undan tvätt',    '👕', 15, 'asneeded', 'parent', 'system'),
  (null, 'Trädgård',   'Vattna blommor',              '🪴', 5,  'daily',    'auto',   'system'),
  (null, 'Trädgård',   'Rensa ogräs',                 '🌿', 20, 'weekly',   'parent', 'system'),
  (null, 'Trädgård',   'Klippa gräset',               '🌱', 30, 'weekly',   'ai',     'system'),
  (null, 'Trädgård',   'Kratta löv',                  '🍂', 20, 'asneeded', 'parent', 'system'),
  (null, 'Trädgård',   'Skotta snö',                  '❄️', 25, 'asneeded', 'parent', 'system'),
  (null, 'Husdjur',    'Mata djuren',                 '🐾', 3,  'daily',    'auto',   'system'),
  (null, 'Husdjur',    'Rasta hunden',                '🐕', 15, 'daily',    'parent', 'system'),
  (null, 'Husdjur',    'Plocka upp efter hund',       '💩', 10, 'asneeded', 'parent', 'system'),
  (null, 'Bil & ärenden', 'Packa upp matvaror',       '🛒', 10, 'weekly',   'parent', 'system'),
  (null, 'Bil & ärenden', 'Tvätta bilen',             '🚗', 25, 'asneeded', 'ai',     'system'),
  (null, 'Skola',      'Läxor klara',                 '📚', 20, 'daily',    'parent', 'system'),
  (null, 'Skola',      'Läsa 30 minuter',             '📖', 15, 'daily',    'parent', 'system');
