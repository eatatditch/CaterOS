-- ════════════════════════════════════════════════════════════════════════════
-- Local dev seed — runs automatically via `supabase db reset`.
--
-- This seed is SAFE and IDEMPOTENT and does NOT require any auth.users rows:
--   • Inserts one demo org (the seed_pipeline_after_org trigger auto-creates the
--     default Sales Pipeline + stages, and there is no FK to auth.users).
--   • Inserts a default location, a menu with categories + items, and a contact.
--   • Every insert uses fixed UUIDs + ON CONFLICT DO NOTHING so re-running is safe.
--
-- Memberships / profiles are intentionally NOT seeded because they require real
-- auth.users rows. To attach yourself to the demo org after creating a test
-- user in Supabase Studio, run (replacing YOUR_USER_ID):
--
--   insert into public.memberships (org_id, user_id, role) values
--     ('00000000-0000-0000-0000-000000000001', 'YOUR_USER_ID', 'owner')
--   on conflict (org_id, user_id) do nothing;
--
-- Note: RLS is enabled on these tables, but `supabase db reset` runs this seed
-- as a superuser/owner role which bypasses RLS, so the inserts succeed.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Demo org (trigger seeds the default pipeline + stages) ──────────────────
insert into public.orgs (id, name, slug, currency, timezone)
values (
  '00000000-0000-0000-0000-000000000001',
  'Acme Catering',
  'acme-catering',
  'USD',
  'America/New_York'
)
on conflict (id) do nothing;

-- ─── Default location ────────────────────────────────────────────────────────
insert into public.locations (id, org_id, name, is_default, city, region, country)
values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'Main Kitchen',
  true,
  'New York',
  'NY',
  'US'
)
on conflict (id) do nothing;

-- ─── Menu ────────────────────────────────────────────────────────────────────
insert into public.menus (id, org_id, name, description, is_active)
values (
  '00000000-0000-0000-0000-000000000100',
  '00000000-0000-0000-0000-000000000001',
  'Core Catering Menu',
  'Demo menu seeded for local development.',
  true
)
on conflict (id) do nothing;

insert into public.menu_categories (id, org_id, menu_id, name, position)
values
  (
    '00000000-0000-0000-0000-000000000110',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000100',
    'Mains',
    0
  ),
  (
    '00000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000100',
    'Sides',
    1
  )
on conflict (id) do nothing;

insert into public.menu_items
  (id, org_id, category_id, name, description, unit_price_cents, unit, min_quantity, is_active)
values
  (
    '00000000-0000-0000-0000-000000000120',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000110',
    'Grilled Chicken Platter',
    'Herb-marinated grilled chicken, served family style.',
    1800,
    'person',
    10,
    true
  ),
  (
    '00000000-0000-0000-0000-000000000121',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000111',
    'Seasonal Vegetable Medley',
    'Roasted seasonal vegetables.',
    600,
    'person',
    10,
    true
  )
on conflict (id) do nothing;

-- ─── Demo contact ────────────────────────────────────────────────────────────
insert into public.contacts
  (id, org_id, first_name, last_name, email, phone, lifecycle_stage, lead_source)
values (
  '00000000-0000-0000-0000-000000000200',
  '00000000-0000-0000-0000-000000000001',
  'Demo',
  'Client',
  'demo.client@example.com',
  '+12125550100',
  'lead',
  'seed'
)
on conflict (id) do nothing;
