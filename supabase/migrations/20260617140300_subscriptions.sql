-- Skermtime — fas 4: Stripe subscription mirror.
-- Stripe is the source of truth; this table is kept in sync by the webhook
-- (service role). families.plan_status (added in fas 2) is also updated so the
-- rest of the app can gate on a single column.

create table public.subscriptions (
  family_id              uuid primary key references public.families (id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text,
  status                 text,
  price_id               text,
  current_period_end     timestamptz,
  updated_at             timestamptz not null default now()
);
create index subscriptions_customer_idx on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Members may read their family's subscription; all writes go through the
-- webhook with the service-role key (no insert/update/delete policy here).
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (family_id in (select public.user_family_ids()));
