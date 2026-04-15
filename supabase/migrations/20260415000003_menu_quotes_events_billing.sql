-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Phase 2–5 · Menus, Quotes, Events, Billing
-- ════════════════════════════════════════════════════════════════════════════

create type dietary_tag as enum (
  'vegetarian','vegan','gluten_free','dairy_free','nut_free','halal','kosher','pescatarian'
);

create type quote_status as enum (
  'draft','sent','viewed','accepted','declined','expired','converted'
);

create type event_status as enum (
  'tentative','confirmed','in_prep','in_progress','delivered','completed','cancelled'
);

create type service_type as enum (
  'delivery','pickup','full_service','drop_off','buffet','plated'
);

create type invoice_status as enum (
  'draft','open','paid','partially_paid','past_due','void','refunded'
);

create type payment_status as enum (
  'pending','succeeded','failed','refunded'
);

-- ─── Menus ────────────────────────────────────────────────────────────────
create table menus (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  version int not null default 1,
  effective_from timestamptz,
  effective_to timestamptz,
  created_at timestamptz not null default now()
);
create index on menus(org_id);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  menu_id uuid not null references menus(id) on delete cascade,
  name text not null,
  position int not null default 0
);
create index on menu_categories(menu_id, position);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  category_id uuid references menu_categories(id) on delete set null,
  name text not null,
  description text,
  image_url text,
  unit_price_cents int not null default 0,
  unit_cost_cents int not null default 0,
  unit text not null default 'person',
  min_quantity int not null default 1,
  is_active boolean not null default true,
  dietary_tags dietary_tag[] not null default '{}',
  allergens text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on menu_items(org_id);
create index on menu_items(category_id);

create table modifier_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  is_required boolean not null default false,
  min_selections int not null default 0,
  max_selections int not null default 1
);

create table modifiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  group_id uuid not null references modifier_groups(id) on delete cascade,
  name text not null,
  price_delta_cents int not null default 0,
  position int not null default 0
);

-- ─── Quotes ───────────────────────────────────────────────────────────────
create table quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  number text not null,
  contact_id uuid references contacts(id) on delete set null,
  deal_id uuid references deals(id) on delete set null,
  status quote_status not null default 'draft',
  headcount int not null default 0,
  event_date timestamptz,
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  service_fee_cents bigint not null default 0,
  delivery_fee_cents bigint not null default 0,
  gratuity_cents bigint not null default 0,
  discount_cents bigint not null default 0,
  total_cents bigint not null default 0,
  deposit_cents bigint not null default 0,
  currency text not null default 'USD',
  notes text,
  terms_html text,
  expires_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  public_token text unique,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, number)
);
create index on quotes(org_id, status);
create index on quotes(org_id, event_date);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  menu_item_id uuid references menu_items(id) on delete set null,
  name text not null,
  description text,
  quantity int not null default 1,
  unit_price_cents int not null default 0,
  total_cents bigint not null default 0,
  position int not null default 0,
  modifiers jsonb not null default '[]'::jsonb
);
create index on quote_items(quote_id, position);

-- ─── Events ───────────────────────────────────────────────────────────────
create table events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  location_id uuid references locations(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  quote_id uuid references quotes(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  name text not null,
  status event_status not null default 'tentative',
  service_type service_type not null default 'delivery',
  headcount int not null default 0,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  setup_at timestamptz,
  breakdown_at timestamptz,
  venue_name text,
  venue_address text,
  venue_notes text,
  notes text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on events(org_id, starts_at);
create index on events(org_id, status);

create table event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  role text not null,
  call_time timestamptz,
  release_time timestamptz,
  hourly_rate_cents int
);
create index on event_staff(event_id);

create table beos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  version int not null default 1,
  pdf_url text,
  generated_at timestamptz not null default now(),
  generated_by uuid references profiles(id) on delete set null
);
create index on beos(event_id, version desc);

-- ─── Billing ──────────────────────────────────────────────────────────────
create table invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  number text not null,
  contact_id uuid references contacts(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  status invoice_status not null default 'draft',
  subtotal_cents bigint not null default 0,
  tax_cents bigint not null default 0,
  total_cents bigint not null default 0,
  amount_paid_cents bigint not null default 0,
  currency text not null default 'USD',
  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,
  stripe_invoice_id text unique,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, number)
);
create index on invoices(org_id, status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  amount_cents bigint not null,
  currency text not null default 'USD',
  status payment_status not null default 'pending',
  method text,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  received_at timestamptz,
  created_at timestamptz not null default now()
);
create index on payments(org_id, invoice_id);

-- ─── triggers ─────────────────────────────────────────────────────────────
create trigger set_updated_at before update on menu_items
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on quotes
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on events
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on invoices
  for each row execute function public.tg_set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS — tenant read for members, write gated by role
-- ════════════════════════════════════════════════════════════════════════════
do $$
declare
  t text;
begin
  foreach t in array array[
    'menus','menu_categories','menu_items','modifier_groups','modifiers',
    'quotes','quote_items','events','event_staff','beos','invoices','payments'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "tenant read" on %I for select using (org_id in (select public.user_org_ids()))',
      t
    );
  end loop;
end$$;

-- writes by role
create policy "ops/manager write" on menus for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));
create policy "ops/manager write" on menu_categories for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));
create policy "ops/manager write" on menu_items for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));
create policy "ops/manager write" on modifier_groups for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));
create policy "ops/manager write" on modifiers for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));

create policy "sales write" on quotes for all
  using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));
create policy "sales write" on quote_items for all
  using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));

create policy "ops/manager write" on events for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));
create policy "ops/manager write" on event_staff for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));
create policy "ops/manager write" on beos for all
  using (public.has_org_role(org_id, 'ops')) with check (public.has_org_role(org_id, 'ops'));

create policy "manager write" on invoices for all
  using (public.has_org_role(org_id, 'manager')) with check (public.has_org_role(org_id, 'manager'));
create policy "manager write" on payments for all
  using (public.has_org_role(org_id, 'manager')) with check (public.has_org_role(org_id, 'manager'));
