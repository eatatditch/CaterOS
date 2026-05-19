-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M3 · Deal stage transition history
-- One row per stage change on a deal. Enables time-in-stage, sales-cycle,
-- and stage-conversion metrics.
-- ════════════════════════════════════════════════════════════════════════════

create table deal_stage_transitions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references orgs(id) on delete cascade,
  deal_id       uuid not null references deals(id) on delete cascade,
  from_stage_id uuid references stages(id) on delete set null,
  to_stage_id   uuid not null references stages(id) on delete restrict,
  actor_id      uuid references profiles(id) on delete set null,
  occurred_at   timestamptz not null default now()
);
create index on deal_stage_transitions(org_id, deal_id, occurred_at desc);
create index on deal_stage_transitions(org_id, to_stage_id, occurred_at);
create index on deal_stage_transitions(org_id, occurred_at);

alter table deal_stage_transitions enable row level security;

create policy "tenant read transitions"
  on deal_stage_transitions for select
  using (org_id in (select public.user_org_ids()));

-- Writes are trigger-only. No app-side insert policy on purpose.

create or replace function public.tg_record_deal_stage_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into deal_stage_transitions (org_id, deal_id, from_stage_id, to_stage_id, actor_id)
    values (new.org_id, new.id, null, new.stage_id, auth.uid());
  elsif new.stage_id is distinct from old.stage_id then
    insert into deal_stage_transitions (org_id, deal_id, from_stage_id, to_stage_id, actor_id)
    values (new.org_id, new.id, old.stage_id, new.stage_id, auth.uid());
  end if;
  return new;
end;
$$;

create trigger deals_record_stage_transition
  after insert or update of stage_id on deals
  for each row execute function public.tg_record_deal_stage_transition();

-- Backfill: synthesize a single "created" transition for every existing deal
-- so the funnel metrics aren't blank on day one.
insert into deal_stage_transitions (org_id, deal_id, from_stage_id, to_stage_id, actor_id, occurred_at)
select org_id, id, null, stage_id, owner_id, created_at
  from deals
  where not exists (
    select 1 from deal_stage_transitions t where t.deal_id = deals.id
  );

notify pgrst, 'reload schema';
