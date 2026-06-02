-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Event staffing — currency on rates + tenant indexes
-- ════════════════════════════════════════════════════════════════════════════
-- event_staff.hourly_rate_cents stored money without a paired currency column,
-- violating the money+currency rule. Add a not-null currency (default 'USD').
-- Also add the org_id tenant indexes the RLS filters lean on for event_staff
-- and beos (both currently only indexed by event_id). RLS is unchanged.

alter table public.event_staff
  add column if not exists currency text not null default 'USD';

create index if not exists event_staff_org_id_idx on public.event_staff (org_id);
create index if not exists beos_org_id_idx on public.beos (org_id);

notify pgrst, 'reload schema';
