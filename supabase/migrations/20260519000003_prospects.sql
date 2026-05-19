-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M4 · Prospects (outbound list)
-- Plus: extend activity_type enum with site_visit / tasting / proposal_send /
-- follow_up / networking, and add activities.prospect_id.
-- ════════════════════════════════════════════════════════════════════════════

create type prospect_segment as enum (
  'corporate_office',
  'wedding_venue',
  'event_planner',
  'hospital',
  'school',
  'nonprofit',
  'other'
);

create type prospect_status as enum (
  'cold',
  'warming',
  'converted_to_lead',
  'dead'
);

create table prospects (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  owner_id           uuid references profiles(id) on delete set null,
  location_id        uuid references locations(id) on delete set null,
  company_name       text not null,
  contact_name       text,
  contact_info       jsonb not null default '{}'::jsonb,
  segment            prospect_segment not null default 'other',
  status             prospect_status  not null default 'cold',
  notes              text,
  converted_deal_id  uuid references deals(id) on delete set null,
  last_touched_at    timestamptz,
  next_touch_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index on prospects(org_id);
create index on prospects(org_id, owner_id, next_touch_at);
create index on prospects(org_id, status);
create index on prospects(org_id, location_id);

create trigger set_updated_at before update on prospects
  for each row execute function public.tg_set_updated_at();

alter table prospects enable row level security;

-- Owner-scoped: managers+ read everything, sales/ops read only their own.
create policy "managers read all prospects" on prospects for select
  using (public.has_org_role(org_id, 'manager'));

create policy "owner-scoped read prospects" on prospects for select
  using (
    org_id in (select public.user_org_ids())
    and owner_id = auth.uid()
  );

create policy "managers write all prospects" on prospects for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

create policy "sales write own prospects" on prospects for all
  using (
    public.has_org_role(org_id, 'sales')
    and owner_id = auth.uid()
  )
  with check (
    public.has_org_role(org_id, 'sales')
    and owner_id = auth.uid()
  );

-- ─── activity_type extensions ─────────────────────────────────────────────
-- New values added safely (enum values cannot be removed). Functions and
-- views in later migrations rely on these existing.
alter type activity_type add value if not exists 'site_visit';
alter type activity_type add value if not exists 'tasting';
alter type activity_type add value if not exists 'proposal_send';
alter type activity_type add value if not exists 'follow_up';
alter type activity_type add value if not exists 'networking';

-- ─── activities.prospect_id ───────────────────────────────────────────────
alter table activities
  add column prospect_id uuid references prospects(id) on delete cascade;

create index on activities(prospect_id, created_at desc);

-- Trigger: bump prospect.last_touched_at on any new activity.
create or replace function public.tg_prospect_touched_by_activity()
returns trigger
language plpgsql
as $$
begin
  if new.prospect_id is not null then
    update prospects
      set last_touched_at = greatest(coalesce(last_touched_at, new.created_at), new.created_at)
      where id = new.prospect_id;
  end if;
  return new;
end;
$$;

create trigger activities_touch_prospect
  after insert on activities
  for each row execute function public.tg_prospect_touched_by_activity();

notify pgrst, 'reload schema';
