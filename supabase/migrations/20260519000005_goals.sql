-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M6 · Goals
-- Per-owner, per-location, per-period revenue + activity targets.
-- Edits write a row to audit_logs for traceability.
-- ════════════════════════════════════════════════════════════════════════════

create type goal_period as enum ('weekly', 'monthly', 'quarterly');

create table goals (
  id                   uuid primary key default gen_random_uuid(),
  org_id               uuid not null references orgs(id) on delete cascade,
  owner_id             uuid references profiles(id) on delete cascade,   -- null = cross-manager
  location_id          uuid references locations(id) on delete cascade,  -- null = cross-location
  period_type          goal_period not null,
  period_start         date not null,
  revenue_goal_cents   bigint not null default 0 check (revenue_goal_cents >= 0),
  activity_goals       jsonb  not null default '{}'::jsonb,
                                            -- e.g. {"outbound_contacts": 25, "tastings": 4, "prospects": 10}
  notes                text,
  created_by           uuid references profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Distinct goal per (owner, location, period) slot. Null is treated as a real
-- value here — coalesce to the nil uuid so the unique index actually fires on
-- cross-manager / cross-location goals.
create unique index goals_unique_slot
  on goals (
    org_id,
    coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid),
    period_type,
    period_start
  );
create index on goals(org_id, period_start);
create index on goals(org_id, owner_id, period_start);

create trigger set_updated_at before update on goals
  for each row execute function public.tg_set_updated_at();

alter table goals enable row level security;

create policy "members read goals" on goals for select
  using (org_id in (select public.user_org_ids()));

-- Owners manage everything. Managers manage their own + cross-manager slots.
-- Sales role cannot create or edit goals.
create policy "owners write goals" on goals for all
  using (public.has_org_role(org_id, 'owner'))
  with check (public.has_org_role(org_id, 'owner'));

create policy "managers write own/shared goals" on goals for all
  using (
    public.has_org_role(org_id, 'manager')
    and (owner_id is null or owner_id = auth.uid())
  )
  with check (
    public.has_org_role(org_id, 'manager')
    and (owner_id is null or owner_id = auth.uid())
  );

-- ─── audit trigger ────────────────────────────────────────────────────────
create or replace function public.tg_audit_goal_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    insert into audit_logs (org_id, actor_id, action, entity, entity_id, diff)
    values (new.org_id, auth.uid(), 'goal.create', 'goals', new.id, to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    v_diff := jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    insert into audit_logs (org_id, actor_id, action, entity, entity_id, diff)
    values (new.org_id, auth.uid(), 'goal.update', 'goals', new.id, v_diff);
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_logs (org_id, actor_id, action, entity, entity_id, diff)
    values (old.org_id, auth.uid(), 'goal.delete', 'goals', old.id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

create trigger audit_goal_changes
  after insert or update or delete on goals
  for each row execute function public.tg_audit_goal_change();

notify pgrst, 'reload schema';
