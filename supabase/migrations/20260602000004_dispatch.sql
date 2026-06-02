-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Phase 4 · Dispatch — driver assignment & delivery status
-- ════════════════════════════════════════════════════════════════════════════

-- Dispatch lifecycle status, distinct from the event's overall status.
create type dispatch_status as enum (
  'unassigned','assigned','en_route','arrived','delivered','completed'
);

-- New columns on events. driver_id references the assigned member's profile
-- (profiles.id == memberships.user_id == auth.users.id).
alter table events
  add column dispatch_status dispatch_status not null default 'unassigned',
  add column driver_id uuid references profiles(id) on delete set null;

create index on events(driver_id);
create index on events(dispatch_status);

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Existing events policies stay as-is:
--   • "tenant read"        select  → any org member
--   • "ops/manager write"  all     → has_org_role(org_id, 'ops')  (ops+ incl. assignment)
-- Add a minimal UPDATE policy so a driver (below ops) can advance the dispatch
-- status of events assigned to them. Scoped to their own org membership and
-- to rows where they are the assigned driver. The WITH CHECK keeps the row
-- assigned to them so they can't reassign it away from themselves.
create policy "driver updates own dispatch" on events for update
  using (
    org_id in (select public.user_org_ids())
    and driver_id = auth.uid()
  )
  with check (
    org_id in (select public.user_org_ids())
    and driver_id = auth.uid()
  );
