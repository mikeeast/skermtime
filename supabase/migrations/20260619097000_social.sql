-- Skermtime — fas 10: social core (friends + group-run bonus + leaderboard).
-- Cross-family reads stay safe WITHOUT SECURITY DEFINER: child writes go through the
-- admin client (service-role) which projects only alias/icon/streak in code, and the
-- parent-facing request rows carry denormalized aliases so RLS alone suffices.

-- Opaque friend code, distinct from login_code so sharing it can never enable login.
alter table public.child_profiles
  add column friend_code text unique
    default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

-- Group-run bonus ledger kind.
alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in
    ('earn_chore', 'earn_strava', 'spend', 'adjust', 'bounty', 'clawback',
     'streak_bonus', 'referral', 'earn_group_bonus'));

-- Group-bonus tuning (per family).
alter table public.families
  add column group_bonus_enabled boolean not null default true,
  add column group_bonus_pct_per_peer integer not null default 10,
  add column group_bonus_cap_pct integer not null default 50;

create index strava_activities_child_started_idx on public.strava_activities (child_id, started_at);

-- ── Friend graph (child ↔ child, parent-approved on both sides) ──
create table public.child_friend_requests (
  id                  uuid primary key default gen_random_uuid(),
  requester_child_id  uuid not null references public.child_profiles (id) on delete cascade,
  requester_family_id uuid not null references public.families (id) on delete cascade,
  requester_alias     text not null,
  requester_icon      text,
  target_child_id     uuid not null references public.child_profiles (id) on delete cascade,
  target_family_id    uuid not null references public.families (id) on delete cascade,
  target_alias        text not null,
  target_icon         text,
  status              text not null default 'pending'
                        check (status in ('pending', 'approved_both', 'rejected', 'cancelled')),
  requester_parent_ok boolean not null default false,
  target_parent_ok    boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (requester_child_id, target_child_id)
);
create index cfr_target_family_idx on public.child_friend_requests (target_family_id);
create index cfr_requester_family_idx on public.child_friend_requests (requester_family_id);

create table public.child_friendships (
  child_a    uuid not null references public.child_profiles (id) on delete cascade,
  child_b    uuid not null references public.child_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (child_a, child_b),
  check (child_a < child_b)
);

alter table public.child_friend_requests enable row level security;
alter table public.child_friendships     enable row level security;

-- Parents see/manage requests touching one of their children (aliases are denormalized).
create policy cfr_select on public.child_friend_requests
  for select to authenticated
  using (
    requester_family_id in (select public.user_family_ids())
    or target_family_id in (select public.user_family_ids())
  );
create policy cfr_update on public.child_friend_requests
  for update to authenticated
  using (
    requester_family_id in (select public.user_family_ids())
    or target_family_id in (select public.user_family_ids())
  )
  with check (
    requester_family_id in (select public.user_family_ids())
    or target_family_id in (select public.user_family_ids())
  );

create policy friendships_select on public.child_friendships
  for select to authenticated
  using (
    exists (
      select 1 from public.child_profiles cp
      where cp.id in (child_a, child_b) and cp.family_id in (select public.user_family_ids())
    )
  );
create policy friendships_insert on public.child_friendships
  for insert to authenticated
  with check (
    exists (
      select 1 from public.child_profiles cp
      where cp.id in (child_a, child_b) and cp.family_id in (select public.user_family_ids())
    )
  );
create policy friendships_delete on public.child_friendships
  for delete to authenticated
  using (
    exists (
      select 1 from public.child_profiles cp
      where cp.id in (child_a, child_b) and cp.family_id in (select public.user_family_ids())
    )
  );

grant all on public.child_friend_requests, public.child_friendships
  to anon, authenticated, service_role;
