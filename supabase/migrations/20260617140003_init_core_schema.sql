-- Skermtime — core schema (fas 1)
-- Multi-tenant foundation: families, parent profiles, membership, child profiles.
-- All tenant data is scoped by family_id and protected by Row Level Security.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table public.families (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  owner_id      uuid not null references auth.users (id) on delete cascade,
  plan_status   text not null default 'trialing'
                  check (plan_status in ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  created_at    timestamptz not null default now()
);

-- Parent display profile, mirrors auth.users (populated by trigger on signup).
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Membership: which adults belong to which family, and their role.
create table public.family_members (
  family_id  uuid not null references public.families (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'parent' check (role in ('owner', 'parent')),
  created_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Children: alias-only, no PII. pin_hash backs the lightweight child login.
create table public.child_profiles (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references public.families (id) on delete cascade,
  alias           text not null,
  pin_hash        text,
  icon            text,
  balance_minutes integer not null default 0,
  created_at      timestamptz not null default now()
);

create index family_members_user_id_idx on public.family_members (user_id);
create index child_profiles_family_id_idx on public.child_profiles (family_id);

-- ─────────────────────────────────────────────────────────────
-- Helper: family ids the current user belongs to.
-- SECURITY DEFINER so policies can call it without recursing into
-- family_members' own RLS.
-- ─────────────────────────────────────────────────────────────
create or replace function public.user_family_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select family_id from public.family_members where user_id = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────────────────

-- Create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When a family is created, enroll its owner as a member with role 'owner'.
create or replace function public.handle_new_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.family_members (family_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_family_created
  after insert on public.families
  for each row execute function public.handle_new_family();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table public.families       enable row level security;
alter table public.profiles       enable row level security;
alter table public.family_members enable row level security;
alter table public.child_profiles enable row level security;

-- families: members read; any authed user creates one they own; owner mutates.
create policy families_select_members on public.families
  for select to authenticated
  using (id in (select public.user_family_ids()));

create policy families_insert_self_owned on public.families
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy families_update_owner on public.families
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy families_delete_owner on public.families
  for delete to authenticated
  using (owner_id = auth.uid());

-- profiles: a user manages only their own profile row.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- family_members: members read rows of their own families; owner manages members.
create policy members_select_same_family on public.family_members
  for select to authenticated
  using (family_id in (select public.user_family_ids()));

create policy members_insert_by_owner on public.family_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.families f
      where f.id = family_id and f.owner_id = auth.uid()
    )
  );

create policy members_delete_by_owner on public.family_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.families f
      where f.id = family_id and f.owner_id = auth.uid()
    )
  );

-- child_profiles: any member of the family can manage children.
create policy children_all_family_members on public.child_profiles
  for all to authenticated
  using (family_id in (select public.user_family_ids()))
  with check (family_id in (select public.user_family_ids()));
