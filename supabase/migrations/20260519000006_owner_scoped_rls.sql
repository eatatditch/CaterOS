-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M7 · Owner-scoped RLS
-- Replace the wide "tenant read" / "sales write" policies on deals,
-- activities, and events with manager-or-self policies. Sales and ops roles
-- can only see and edit rows they own. Managers and owners see everything in
-- the org.
--
-- Contacts and companies remain org-wide on purpose — a manager can hand off
-- a contact between owners, and the contact directory needs to be searchable.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── deals ────────────────────────────────────────────────────────────────
drop policy if exists "tenant read"  on deals;
drop policy if exists "sales write"  on deals;

create policy "managers read all deals" on deals for select
  using (public.has_org_role(org_id, 'manager'));

create policy "owner-scoped read deals" on deals for select
  using (
    org_id in (select public.user_org_ids())
    and owner_id = auth.uid()
  );

create policy "managers write all deals" on deals for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

create policy "owner-scoped write deals" on deals for all
  using (
    public.has_org_role(org_id, 'sales')
    and owner_id = auth.uid()
  )
  with check (
    public.has_org_role(org_id, 'sales')
    and (owner_id = auth.uid() or owner_id is null)
  );

-- ─── activities ───────────────────────────────────────────────────────────
-- Visibility follows the parent: if you can see the deal/prospect, you can
-- see the activity. owner_id on the activity itself is the writer.
drop policy if exists "tenant read"  on activities;
drop policy if exists "sales write"  on activities;

create policy "managers read all activities" on activities for select
  using (public.has_org_role(org_id, 'manager'));

create policy "owner-scoped read activities" on activities for select
  using (
    org_id in (select public.user_org_ids())
    and (
      owner_id = auth.uid()
      or deal_id in (select id from deals where owner_id = auth.uid())
      or prospect_id in (select id from prospects where owner_id = auth.uid())
    )
  );

create policy "managers write all activities" on activities for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

create policy "owner-scoped write activities" on activities for all
  using (
    public.has_org_role(org_id, 'sales')
    and (
      owner_id = auth.uid()
      or deal_id in (select id from deals where owner_id = auth.uid())
      or prospect_id in (select id from prospects where owner_id = auth.uid())
    )
  )
  with check (
    public.has_org_role(org_id, 'sales')
    and (
      owner_id = auth.uid()
      or deal_id in (select id from deals where owner_id = auth.uid())
      or prospect_id in (select id from prospects where owner_id = auth.uid())
    )
  );

-- ─── events ───────────────────────────────────────────────────────────────
-- Events keep their existing "tenant read" because ops/dispatch needs to see
-- the full schedule, but writes get owner-scoped for sales-rank users. Ops
-- and above can edit any event.
drop policy if exists "ops/manager write" on events;

create policy "ops+ write all events" on events for all
  using (public.has_org_role(org_id, 'ops'))
  with check (public.has_org_role(org_id, 'ops'));

create policy "owner-scoped write events" on events for all
  using (
    public.has_org_role(org_id, 'sales')
    and owner_id = auth.uid()
  )
  with check (
    public.has_org_role(org_id, 'sales')
    and (owner_id = auth.uid() or owner_id is null)
  );

notify pgrst, 'reload schema';
