-- Local dev seed — only run via `supabase db reset`
-- Creates one demo org and a couple of menu items if you've created a test user.
-- Replace USER_ID with your own auth.users.id to attach memberships.

-- example (uncomment after creating a test user via Studio):
-- insert into public.orgs (id, name, slug) values
--   ('00000000-0000-0000-0000-000000000001', 'Acme Catering', 'acme-catering');
-- insert into public.memberships (org_id, user_id, role) values
--   ('00000000-0000-0000-0000-000000000001', 'YOUR_USER_ID', 'owner');
