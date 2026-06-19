-- Skermtime — fas 10d: co-op kompis-utmaningar.
-- Gemensamt mål bland vänner; när gruppen når målet får varje medlem reward_minutes.

alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in
    ('earn_chore', 'earn_strava', 'spend', 'adjust', 'bounty', 'clawback',
     'streak_bonus', 'referral', 'earn_group_bonus', 'earn_challenge'));

create table public.challenges (
  id               uuid primary key default gen_random_uuid(),
  created_by_child uuid not null references public.child_profiles (id) on delete cascade,
  family_id        uuid not null references public.families (id) on delete cascade,
  title            text not null,
  metric           text not null check (metric in ('distance_m', 'runs', 'earn_minutes')),
  goal             numeric not null check (goal > 0),
  reward_minutes   integer not null default 30 check (reward_minutes >= 0),
  starts_at        timestamptz not null default now(),
  ends_at          timestamptz not null,
  status           text not null default 'active' check (status in ('active', 'completed', 'expired')),
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create table public.challenge_members (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  child_id     uuid not null references public.child_profiles (id) on delete cascade,
  family_id    uuid not null references public.families (id) on delete cascade,
  rewarded     boolean not null default false,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, child_id)
);
create index challenge_members_child_idx on public.challenge_members (child_id);

alter table public.challenges        enable row level security;
alter table public.challenge_members enable row level security;

-- Parents can read a challenge if one of their children is a member.
create policy challenges_select on public.challenges
  for select to authenticated
  using (
    id in (
      select cm.challenge_id from public.challenge_members cm
      join public.child_profiles cp on cp.id = cm.child_id
      where cp.family_id in (select public.user_family_ids())
    )
  );

-- Parents read membership rows for their own family's children (no self-recursion).
create policy challenge_members_select on public.challenge_members
  for select to authenticated
  using (family_id in (select public.user_family_ids()));

grant all on public.challenges, public.challenge_members
  to anon, authenticated, service_role;
