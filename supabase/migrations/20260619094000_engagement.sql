-- Skermtime — fas 7: streaks, badges (märken), daily-checklist enforcement, timezone.

-- Family timezone — all "today"/"this week" boundaries resolve against this.
alter table public.families
  add column timezone text not null default 'Europe/Stockholm';

-- Extend the ledger kind CHECK with streak_bonus (milestone reward).
alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in
    ('earn_chore', 'earn_strava', 'spend', 'adjust', 'bounty', 'clawback', 'streak_bonus'));

-- Recurring-chore "already done this period" is enforced in the app layer
-- (lib/earning/period.ts) because a tz-correct local-day expression is not
-- IMMUTABLE and so cannot back a unique index.

-- Streak cache. Recomputed idempotently from the ledger; never incremented.
create table public.child_streaks (
  child_id       uuid primary key references public.child_profiles (id) on delete cascade,
  family_id      uuid not null references public.families (id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_active_day date,
  updated_at     timestamptz not null default now()
);
create index child_streaks_family_idx on public.child_streaks (family_id);

-- Badge catalogue (global reference) + per-child awards.
create table public.badges (
  id          text primary key,
  name        text not null,
  description text not null,
  icon        text not null,
  threshold   integer,
  kind        text not null
                check (kind in ('streak', 'km_total', 'chores_total', 'first_ai', 'first_chore'))
);
create table public.child_badges (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  child_id   uuid not null references public.child_profiles (id) on delete cascade,
  badge_id   text not null references public.badges (id),
  awarded_at timestamptz not null default now(),
  unique (child_id, badge_id)
);
create index child_badges_child_idx on public.child_badges (child_id);

-- ── RLS (family-scoped; badge catalogue readable by all signed-in users) ──
alter table public.child_streaks enable row level security;
alter table public.child_badges  enable row level security;
alter table public.badges        enable row level security;

create policy child_streaks_all on public.child_streaks
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy child_badges_all on public.child_badges
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy badges_select on public.badges
  for select to authenticated using (true);

-- Explicit grants (default privileges should cover these, but be explicit).
grant all on public.child_streaks, public.child_badges, public.badges
  to anon, authenticated, service_role;

-- ── Seed the badge catalogue (Swedish) ──
insert into public.badges (id, name, description, icon, threshold, kind) values
  ('first_chore', 'Första sysslan', 'Du loggade din första syssla!',     '🌟', 1,   'first_chore'),
  ('chores_50',   '50 sysslor',     'Femtio avklarade sysslor.',          '✅', 50,  'chores_total'),
  ('streak_7',    '7-dagars-svit',  'Aktiv sju dagar i rad.',             '🔥', 7,   'streak'),
  ('streak_30',   'Månadssvit',     'Aktiv trettio dagar i rad.',         '🏆', 30,  'streak'),
  ('km_100',      '100 km',         'Hundra kilometer löpning totalt.',   '🏃', 100, 'km_total'),
  ('first_ai',    'Robotgranskad',  'Din första AI-godkända syssla.',     '🤖', null, 'first_ai')
on conflict (id) do nothing;
