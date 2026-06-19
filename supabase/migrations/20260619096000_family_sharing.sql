-- Skermtime — fas 9: family sharing (co-parent invites) + referral growth loop.

-- Extend the ledger kind CHECK with referral rewards.
alter table public.ledger_entries drop constraint ledger_entries_kind_check;
alter table public.ledger_entries add constraint ledger_entries_kind_check
  check (kind in
    ('earn_chore', 'earn_strava', 'spend', 'adjust', 'bounty', 'clawback',
     'streak_bonus', 'referral'));

-- ── Co-parent invites ──
create table public.family_invites (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.families (id) on delete cascade,
  code        text not null unique default upper(substr(md5(random()::text), 1, 8)),
  invited_by  uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default now() + interval '14 days',
  created_at  timestamptz not null default now()
);
create index family_invites_code_idx on public.family_invites (code);

alter table public.family_invites enable row level security;
create policy family_invites_all on public.family_invites
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

-- Accepting needs elevation: members_insert_by_owner only lets the owner add members.
create or replace function public.accept_family_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.family_invites;
begin
  select * into inv from public.family_invites
    where code = p_code and accepted_by is null and expires_at > now()
    limit 1;
  if not found then return null; end if;
  insert into public.family_members (family_id, user_id, role)
    values (inv.family_id, auth.uid(), 'parent')
    on conflict do nothing;
  update public.family_invites
    set accepted_by = auth.uid(), accepted_at = now()
    where id = inv.id;
  return inv.family_id;
end;
$$;

-- ── Referral (family-to-family) ──
create table public.referral_codes (
  family_id  uuid primary key references public.families (id) on delete cascade,
  code       text not null unique default upper(substr(md5(random()::text), 1, 8)),
  created_at timestamptz not null default now()
);
create table public.referral_redemptions (
  id                 uuid primary key default gen_random_uuid(),
  referrer_family_id uuid not null references public.families (id) on delete cascade,
  referred_family_id uuid not null references public.families (id) on delete cascade unique,
  reward_minutes     integer not null default 0,
  created_at         timestamptz not null default now()
);

alter table public.referral_codes       enable row level security;
alter table public.referral_redemptions enable row level security;

create policy referral_codes_all on public.referral_codes
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));

create policy referral_redemptions_select on public.referral_redemptions
  for select to authenticated
  using (
    referrer_family_id in (select public.user_family_ids())
    or referred_family_id in (select public.user_family_ids())
  );

-- Redeem: called by the NEW family's owner. Referrer gets bonus minutes (they have
-- a child); the referred family gets a 30-day trial extension (no child needed yet).
create or replace function public.redeem_referral(p_code text, p_referred_family uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_family uuid;
  reward     int := 120;
  child_a    uuid;
begin
  if not exists (
    select 1 from public.families where id = p_referred_family and owner_id = auth.uid()
  ) then
    return false;
  end if;
  select family_id into ref_family from public.referral_codes where code = p_code;
  if ref_family is null or ref_family = p_referred_family then return false; end if;
  if exists (
    select 1 from public.referral_redemptions where referred_family_id = p_referred_family
  ) then
    return false;
  end if;

  insert into public.referral_redemptions (referrer_family_id, referred_family_id, reward_minutes)
    values (ref_family, p_referred_family, reward);

  select id into child_a from public.child_profiles
    where family_id = ref_family order by created_at limit 1;
  if child_a is not null then
    insert into public.ledger_entries (family_id, child_id, delta_minutes, kind, source_type, note)
      values (ref_family, child_a, reward, 'referral', 'referral', 'Värvningsbonus 🎁');
  end if;

  update public.families
    set trial_ends_at = greatest(trial_ends_at, now()) + interval '30 days'
    where id = p_referred_family and plan_status = 'trialing';
  return true;
end;
$$;

grant all on public.family_invites, public.referral_codes, public.referral_redemptions
  to anon, authenticated, service_role;
grant execute on function public.accept_family_invite(text) to authenticated;
grant execute on function public.redeem_referral(text, uuid) to authenticated;
