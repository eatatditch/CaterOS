-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Metrics layer · M1+M2 · Extensions to deals and events
-- New enums: lead_source, event_type
-- New columns on deals: source (enum), source_detail, location_id, event_type,
--   estimated_event_date, first_response_at, last_activity_at, lost_reason
-- New columns on events: event_type, gross_revenue_cents, food_cost_cents,
--   labor_cost_cents, net_margin_cents (generated), parent_event_id
-- Triggers: first_response_at / last_activity_at on activities insert,
--   closed_at on deals stage change into a won/lost stage.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── enums ────────────────────────────────────────────────────────────────
create type lead_source as enum (
  'inbound', 'outbound', 'referral', 'paid_ad', 'event', 'walkup'
);

create type event_type as enum (
  'corporate', 'wedding', 'social', 'holiday', 'other'
);

-- ─── deals: new columns ───────────────────────────────────────────────────
-- Convert deals.source from text to lead_source. Keep the raw string in
-- source_detail so we don't lose attribution (eg "Meta", "Google",
-- referrer name).
alter table deals
  add column source_detail text;

update deals
  set source_detail = source
  where source is not null;

-- Map existing text values to the enum.
alter table deals
  alter column source drop default,
  alter column source type lead_source
    using case
      when source in ('inbound','outbound','referral','paid_ad','event','walkup') then source::lead_source
      when source is null then null
      else 'inbound'::lead_source
    end;

alter table deals
  add column location_id           uuid references locations(id) on delete set null,
  add column event_type            event_type,
  add column estimated_event_date  timestamptz,
  add column first_response_at     timestamptz,
  add column last_activity_at      timestamptz,
  add column lost_reason           text;

create index on deals(org_id, location_id);
create index on deals(org_id, owner_id, last_activity_at);
create index on deals(org_id, first_response_at);
create index on deals(org_id, estimated_event_date);

-- Backfill last_activity_at from existing activity history.
update deals d set last_activity_at = sub.max_created
  from (
    select deal_id, max(created_at) as max_created
    from activities
    where deal_id is not null
    group by deal_id
  ) sub
  where sub.deal_id = d.id;

-- Backfill first_response_at: earliest outbound activity per deal.
update deals d set first_response_at = sub.first_at
  from (
    select deal_id, min(created_at) as first_at
    from activities
    where deal_id is not null
      and type in ('call','email','meeting','sms')
    group by deal_id
  ) sub
  where sub.deal_id = d.id;

-- ─── events: new columns ──────────────────────────────────────────────────
alter table events
  add column event_type           event_type,
  add column gross_revenue_cents  bigint not null default 0,
  add column food_cost_cents      bigint not null default 0,
  add column labor_cost_cents     bigint not null default 0,
  add column net_margin_cents     bigint generated always as
    (gross_revenue_cents - food_cost_cents - labor_cost_cents) stored,
  add column parent_event_id      uuid references events(id) on delete set null;

create index on events(org_id, event_type);
create index on events(org_id, parent_event_id);

-- ─── triggers: keep deal timestamps in sync with activity inserts ─────────
create or replace function public.tg_deal_touched_by_activity()
returns trigger
language plpgsql
as $$
begin
  if new.deal_id is not null then
    update deals
      set last_activity_at = greatest(coalesce(last_activity_at, new.created_at), new.created_at),
          first_response_at = case
            when first_response_at is null
              and new.type in ('call','email','meeting','sms')
            then new.created_at
            else first_response_at
          end
      where id = new.deal_id;
  end if;
  return new;
end;
$$;

create trigger activities_touch_deal
  after insert on activities
  for each row execute function public.tg_deal_touched_by_activity();

-- ─── trigger: closed_at on won/lost stage entry ───────────────────────────
create or replace function public.tg_deal_closed_at()
returns trigger
language plpgsql
as $$
declare
  v_is_terminal boolean;
begin
  if (tg_op = 'INSERT') or (new.stage_id is distinct from old.stage_id) then
    select (is_won or is_lost) into v_is_terminal
      from stages where id = new.stage_id;
    if coalesce(v_is_terminal, false) then
      new.closed_at := coalesce(new.closed_at, now());
    else
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger deals_set_closed_at
  before insert or update of stage_id on deals
  for each row execute function public.tg_deal_closed_at();

-- Backfill closed_at for already-terminal deals.
update deals d set closed_at = coalesce(d.closed_at, d.updated_at)
  from stages s
  where s.id = d.stage_id and (s.is_won or s.is_lost) and d.closed_at is null;

-- ─── capture_lead update ──────────────────────────────────────────────────
-- Maps the public p_source string to the new lead_source enum and keeps the
-- raw string in deals.source_detail. Signature is unchanged so the existing
-- API + widget continue to work.
drop function if exists public.capture_lead(
  text, text, text, text, text, text, text, text, text, uuid, int, text, text
);

create or replace function public.capture_lead(
  p_org_slug text,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_company text,
  p_event_date text,
  p_event_time text,
  p_service_type text,
  p_location_id uuid,
  p_headcount int,
  p_message text,
  p_source text default 'inbound'
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_contact_id uuid;
  v_company_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_owner_id uuid;
  v_deal_id uuid;
  v_event_ts timestamptz;
  v_service_enum service_type;
  v_source lead_source;
  v_source_detail text;
begin
  select id into v_org_id from orgs where slug = p_org_slug;
  if v_org_id is null then raise exception 'org_not_found'; end if;

  if p_event_date is not null and length(trim(p_event_date)) > 0 then
    begin
      v_event_ts := (trim(p_event_date) || ' ' || coalesce(nullif(trim(p_event_time), ''), '12:00') || ':00')::timestamptz;
    exception when others then v_event_ts := null; end;
  end if;

  if p_service_type is not null then
    v_service_enum := case
      when lower(p_service_type) ~ '(on[_\s-]?premise|full[_\s-]?service|plated)' then 'full_service'::service_type
      when lower(p_service_type) ~ '(off[_\s-]?premise|drop[_\s-]?off)' then 'drop_off'::service_type
      when lower(p_service_type) ~ 'pickup' then 'pickup'::service_type
      when lower(p_service_type) ~ 'buffet' then 'buffet'::service_type
      when lower(p_service_type) ~ 'delivery' then 'delivery'::service_type
      else null
    end;
  end if;

  -- Source mapping: the public API accepts arbitrary strings (hostname,
  -- "web_form", etc.). Anything that isn't one of the six enum values is
  -- treated as inbound and the raw string preserved in source_detail.
  v_source_detail := nullif(trim(coalesce(p_source, '')), '');
  v_source := case
    when p_source in ('inbound','outbound','referral','paid_ad','event','walkup')
      then p_source::lead_source
    else 'inbound'::lead_source
  end;

  if p_company is not null and length(trim(p_company)) > 0 then
    insert into companies (org_id, name) values (v_org_id, trim(p_company))
    returning id into v_company_id;
  end if;

  insert into contacts (org_id, company_id, first_name, last_name, email, phone, lifecycle_stage, lead_source)
  values (v_org_id, v_company_id, p_first_name, p_last_name, p_email, p_phone, 'lead', coalesce(v_source_detail, 'inbound'))
  returning id into v_contact_id;

  select id into v_pipeline_id from pipelines where org_id = v_org_id and is_default order by created_at limit 1;
  select id into v_stage_id from stages where pipeline_id = v_pipeline_id and name = 'Lead' limit 1;

  v_owner_id := pick_lead_owner(v_org_id);

  insert into deals (
    org_id, pipeline_id, stage_id, contact_id, company_id, owner_id,
    title, source, source_detail, location_id, estimated_event_date,
    expected_close_date, custom_fields
  )
  values (
    v_org_id, v_pipeline_id, v_stage_id, v_contact_id, v_company_id, v_owner_id,
    coalesce(trim(p_first_name || ' ' || coalesce(p_last_name, '')), p_email) ||
      case when v_event_ts is not null then ' · ' || to_char(v_event_ts, 'Mon DD') else '' end ||
      case when coalesce(p_headcount, 0) > 0 then ' · ' || p_headcount || ' pax' else '' end,
    v_source, v_source_detail, p_location_id, v_event_ts,
    v_event_ts,
    jsonb_strip_nulls(jsonb_build_object(
      'service_type_raw', p_service_type,
      'service_type', v_service_enum,
      'location_id', p_location_id,
      'event_time', p_event_time,
      'headcount', p_headcount
    ))
  )
  returning id into v_deal_id;

  if p_message is not null and length(trim(p_message)) > 0 then
    insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
    values (v_org_id, 'note', v_contact_id, v_deal_id, 'Inbound web form', p_message,
            jsonb_build_object(
              'headcount', p_headcount,
              'event_date', p_event_date,
              'event_time', p_event_time,
              'service_type', p_service_type,
              'location_id', p_location_id,
              'source', p_source));
  end if;

  return v_deal_id;
end;
$$;

grant execute on function public.capture_lead(
  text, text, text, text, text, text, text, text, text, uuid, int, text, text
) to service_role;

notify pgrst, 'reload schema';
