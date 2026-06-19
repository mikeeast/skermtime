-- Skermtime — fas 8: notifications + agent schedule-lock (bedtime / quiet hours).

-- ── Notification preferences (per family) + sent-log (idempotency) ──
create table public.notification_prefs (
  family_id            uuid primary key references public.families (id) on delete cascade,
  email_approvals      boolean not null default true,
  email_low_balance    boolean not null default true,
  email_weekly         boolean not null default true,
  low_balance_threshold integer not null default 15,
  updated_at           timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  child_id   uuid references public.child_profiles (id) on delete cascade,
  type       text not null check (type in ('approval_pending', 'low_balance', 'weekly_summary')),
  dedupe_key text not null,
  sent_at    timestamptz,
  created_at timestamptz not null default now(),
  unique (family_id, dedupe_key)
);

-- ── Bedtime / quiet-hours lock schedules (per child) ──
-- Stored as minutes-from-local-midnight + an ISO weekday array (1=Mon..7=Sun) so
-- the agent needs zero timezone math — only integer comparisons.
create table public.lock_schedules (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.families (id) on delete cascade,
  child_id   uuid not null references public.child_profiles (id) on delete cascade,
  label      text not null default 'Läggdags',
  days       smallint[] not null default '{1,2,3,4}',
  start_min  smallint not null,
  end_min    smallint not null,   -- wraps past midnight when end_min <= start_min
  enabled    boolean not null default true,
  created_at timestamptz not null default now()
);
create index lock_schedules_child_idx on public.lock_schedules (child_id);

-- Optional per-child daily screen-time cap (null = no cap), enforced by the agent.
alter table public.child_profiles add column daily_screen_cap_minutes integer;

-- ── RLS (family-scoped) ──
alter table public.notification_prefs enable row level security;
alter table public.notifications      enable row level security;
alter table public.lock_schedules     enable row level security;

create policy notification_prefs_all on public.notification_prefs
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

-- Sent-log is written by service-role only; parents may read their own.
create policy notifications_select on public.notifications
  for select to authenticated
  using (family_id in (select public.user_family_ids()));

create policy lock_schedules_all on public.lock_schedules
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

grant all on public.notification_prefs, public.notifications, public.lock_schedules
  to anon, authenticated, service_role;
