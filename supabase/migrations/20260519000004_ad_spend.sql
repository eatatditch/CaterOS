-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M5 · Paid ad spend
-- Manual entry initially. Schema designed so an ingestion worker (Meta /
-- Google APIs) can insert rows with the same shape later — no app changes.
-- ════════════════════════════════════════════════════════════════════════════

create type ad_channel as enum ('meta', 'google', 'other');

create table ad_spend (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references orgs(id) on delete cascade,
  location_id    uuid references locations(id) on delete set null,
  channel        ad_channel not null,
  campaign_name  text,
  spend_cents    bigint not null check (spend_cents >= 0),
  currency       text not null default 'USD',
  period_start   date not null,
  period_end     date not null,
  external_ref   text,                              -- meta/google campaign id when ingested via API
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  check (period_end >= period_start)
);
create index on ad_spend(org_id, period_start);
create index on ad_spend(org_id, channel, period_start);
create index on ad_spend(org_id, location_id, period_start);
create unique index on ad_spend(org_id, channel, coalesce(external_ref, ''), period_start)
  where external_ref is not null;

alter table ad_spend enable row level security;

create policy "members read ad spend" on ad_spend for select
  using (org_id in (select public.user_org_ids()));

create policy "managers write ad spend" on ad_spend for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

notify pgrst, 'reload schema';
