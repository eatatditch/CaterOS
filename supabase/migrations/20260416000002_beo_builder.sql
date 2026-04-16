-- ════════════════════════════════════════════════════════════════════════════
-- Expand the beos table into a real structured document:
--   title, status (draft/final), content JSONB blob for all BEO sections,
--   notes free-text, finalized_at/finalized_by for version locking.
-- ════════════════════════════════════════════════════════════════════════════

create type beo_status as enum ('draft', 'final');

alter table public.beos
  add column if not exists title text,
  add column if not exists status beo_status not null default 'draft',
  add column if not exists content jsonb not null default '{}',
  add column if not exists notes text,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references profiles(id) on delete set null;

-- Write policy — ops+ role (same as events)
create policy "ops write beos" on beos for insert
  with check (public.has_org_role(org_id, 'ops'));
create policy "ops update beos" on beos for update
  using (public.has_org_role(org_id, 'ops'));
create policy "ops delete beos" on beos for delete
  using (public.has_org_role(org_id, 'ops'));

notify pgrst, 'reload schema';
