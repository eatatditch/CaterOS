-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Phase 1 · CRM core
-- Companies, contacts, pipelines, stages, deals, activities
-- ════════════════════════════════════════════════════════════════════════════

create type lifecycle_stage as enum (
  'subscriber', 'lead', 'mql', 'sql', 'opportunity', 'customer', 'evangelist', 'other'
);

create type activity_type as enum (
  'note', 'call', 'email', 'meeting', 'task', 'sms', 'event_log'
);

-- ─── companies ────────────────────────────────────────────────────────────
create table companies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  domain text,
  industry text,
  website text,
  phone text,
  address_line_1 text,
  city text,
  region text,
  postal_code text,
  country text,
  owner_id uuid references profiles(id) on delete set null,
  custom_fields jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on companies(org_id);
create index on companies(org_id, name);

-- ─── contacts ─────────────────────────────────────────────────────────────
create table contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  first_name text,
  last_name text,
  email citext,
  phone text,
  job_title text,
  lifecycle_stage lifecycle_stage not null default 'lead',
  lead_source text,
  owner_id uuid references profiles(id) on delete set null,
  lead_score int not null default 0,
  do_not_email boolean not null default false,
  do_not_call boolean not null default false,
  custom_fields jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on contacts(org_id);
create index on contacts(org_id, email);
create index on contacts(org_id, lifecycle_stage);
create index on contacts(org_id, owner_id);

-- ─── pipelines + stages ───────────────────────────────────────────────────
create table pipelines (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on pipelines(org_id);

create table stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines(id) on delete cascade,
  name text not null,
  position int not null default 0,
  probability int not null default 0 check (probability between 0 and 100),
  is_won boolean not null default false,
  is_lost boolean not null default false
);
create index on stages(pipeline_id, position);

-- ─── deals ────────────────────────────────────────────────────────────────
create table deals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  pipeline_id uuid not null references pipelines(id) on delete restrict,
  stage_id uuid not null references stages(id) on delete restrict,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  title text not null,
  amount_cents bigint not null default 0,
  currency text not null default 'USD',
  expected_close_date timestamptz,
  closed_at timestamptz,
  source text,
  custom_fields jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on deals(org_id, stage_id);
create index on deals(org_id, owner_id);
create index on deals(org_id, expected_close_date);

-- ─── activities ───────────────────────────────────────────────────────────
create table activities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  type activity_type not null,
  contact_id uuid references contacts(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  owner_id uuid references profiles(id) on delete set null,
  subject text,
  body text,
  meta jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on activities(org_id, due_at);
create index on activities(contact_id, created_at desc);
create index on activities(deal_id, created_at desc);

-- ─── triggers ─────────────────────────────────────────────────────────────
create trigger set_updated_at before update on companies
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on contacts
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on deals
  for each row execute function public.tg_set_updated_at();

-- ─── seed default pipeline on org creation ────────────────────────────────
create or replace function public.seed_default_pipeline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pipeline_id uuid;
begin
  insert into public.pipelines (org_id, name, is_default)
  values (new.id, 'Sales Pipeline', true)
  returning id into v_pipeline_id;

  insert into public.stages (pipeline_id, name, position, probability, is_won, is_lost) values
    (v_pipeline_id, 'Lead',        0, 10,  false, false),
    (v_pipeline_id, 'Qualified',   1, 30,  false, false),
    (v_pipeline_id, 'Proposal',    2, 50,  false, false),
    (v_pipeline_id, 'Booked',      3, 90,  false, false),
    (v_pipeline_id, 'Delivered',   4, 100, true,  false),
    (v_pipeline_id, 'Lost',        5, 0,   false, true);

  return new;
end;
$$;

create trigger seed_pipeline_after_org
  after insert on orgs
  for each row execute function public.seed_default_pipeline();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════
alter table companies   enable row level security;
alter table contacts    enable row level security;
alter table pipelines   enable row level security;
alter table stages      enable row level security;
alter table deals       enable row level security;
alter table activities  enable row level security;

-- read for any member; write for sales+
create policy "tenant read" on companies for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on companies for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));

create policy "tenant read" on contacts for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on contacts for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));

create policy "tenant read" on pipelines for select using (org_id in (select public.user_org_ids()));
create policy "manager write" on pipelines for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

create policy "tenant read" on stages for select using (
  pipeline_id in (select id from pipelines where org_id in (select public.user_org_ids()))
);
create policy "manager write" on stages for all
  using (
    pipeline_id in (
      select id from pipelines
      where public.has_org_role(org_id, 'manager')
    )
  )
  with check (
    pipeline_id in (
      select id from pipelines
      where public.has_org_role(org_id, 'manager')
    )
  );

create policy "tenant read" on deals for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on deals for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));

create policy "tenant read" on activities for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on activities for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));
