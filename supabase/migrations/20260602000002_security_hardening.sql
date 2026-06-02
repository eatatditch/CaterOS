-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Security hardening
--   1. stripe_events — event-level webhook idempotency (service-role only)
--   2. gmail_connections — restrict token reads to managers+
--   3. audit_logs — allow org members to INSERT for their org
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Stripe webhook event ledger ─────────────────────────────────────────
-- The webhook inserts each event id with on-conflict-do-nothing; a duplicate
-- (Stripe redelivery) is acked without reprocessing. Service-role only,
-- mirroring password_resets (RLS enabled, no anon/authenticated policies).
create table if not exists public.stripe_events (
  event_id text primary key,
  type text,
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies: anon / authenticated cannot read or write. Only service_role
-- (which bypasses RLS) touches this table from the webhook handler.

-- ─── 2. Restrict Gmail token reads to managers+ ─────────────────────────────
-- The previous SELECT policy let every org member read access_token /
-- refresh_token. Replace it with a managers+ gate.
drop policy if exists "members read connection meta" on public.gmail_connections;
create policy "managers read gmail connections" on public.gmail_connections for select
  using (public.has_org_role(org_id, 'manager'));

-- ─── 3. Allow org members to write audit logs for their org ─────────────────
-- audit_logs had RLS + a SELECT policy but no INSERT policy, so RLS-scoped
-- app code could never write entries. Allow inserts scoped to the member's org.
create policy "members can insert audit logs for their orgs"
  on public.audit_logs for insert
  with check (org_id in (select public.user_org_ids()));
