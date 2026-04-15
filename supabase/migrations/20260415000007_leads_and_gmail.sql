-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Lead hygiene + Gmail OAuth integration
-- ════════════════════════════════════════════════════════════════════════════

-- Stop auto-creating tentative events from capture_lead — leads are just
-- leads until someone qualifies them. Event details (date/time/service
-- type/location) remain on deal.custom_fields + deal.expected_close_date.
create or replace function public.capture_lead(
  p_org_slug text,
  p_first_name text, p_last_name text, p_email text, p_phone text,
  p_company text,
  p_event_date text, p_event_time text,
  p_service_type text, p_location_id uuid,
  p_headcount int, p_message text,
  p_source text default 'web_form'
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid; v_contact_id uuid; v_company_id uuid;
  v_pipeline_id uuid; v_stage_id uuid; v_owner_id uuid; v_deal_id uuid;
  v_event_ts timestamptz; v_service_enum service_type;
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

  if p_company is not null and length(trim(p_company)) > 0 then
    insert into companies (org_id, name) values (v_org_id, trim(p_company))
    returning id into v_company_id;
  end if;

  insert into contacts (org_id, company_id, first_name, last_name, email, phone, lifecycle_stage, lead_source)
  values (v_org_id, v_company_id, p_first_name, p_last_name, p_email, p_phone, 'lead', p_source)
  returning id into v_contact_id;

  select id into v_pipeline_id from pipelines where org_id = v_org_id and is_default order by created_at limit 1;
  select id into v_stage_id from stages where pipeline_id = v_pipeline_id and name = 'Lead' limit 1;

  v_owner_id := pick_lead_owner(v_org_id);

  insert into deals (
    org_id, pipeline_id, stage_id, contact_id, company_id, owner_id,
    title, source, expected_close_date, custom_fields
  )
  values (
    v_org_id, v_pipeline_id, v_stage_id, v_contact_id, v_company_id, v_owner_id,
    coalesce(trim(p_first_name || ' ' || coalesce(p_last_name, '')), p_email) ||
      case when v_event_ts is not null then ' · ' || to_char(v_event_ts, 'Mon DD') else '' end ||
      case when coalesce(p_headcount, 0) > 0 then ' · ' || p_headcount || ' pax' else '' end,
    p_source, v_event_ts,
    jsonb_strip_nulls(jsonb_build_object(
      'service_type_raw', p_service_type, 'service_type', v_service_enum,
      'location_id', p_location_id, 'event_time', p_event_time, 'headcount', p_headcount
    ))
  ) returning id into v_deal_id;

  insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
  values (v_org_id, 'note', v_contact_id, v_deal_id,
          'Inbound web form',
          coalesce(p_message, '(no message)'),
          jsonb_build_object(
            'headcount', p_headcount, 'event_date', p_event_date, 'event_time', p_event_time,
            'service_type', p_service_type, 'location_id', p_location_id,
            'source', p_source, 'inbound', true));
  return v_deal_id;
end;
$$;

-- Cleanup: remove tentative events that were auto-created from web-form leads.
delete from events e
using contacts c
where e.contact_id = c.id
  and c.lead_source = 'web_form'
  and e.status = 'tentative';

-- Gmail OAuth connections (org-level, single shared mailbox per org).
create table if not exists gmail_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  email citext not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, email)
);
create index if not exists gmail_connections_org_idx on gmail_connections(org_id);

create trigger set_updated_at before update on gmail_connections
  for each row execute function public.tg_set_updated_at();

alter table gmail_connections enable row level security;
create policy "members read connection meta" on gmail_connections for select
  using (org_id in (select public.user_org_ids()));
create policy "managers manage connections" on gmail_connections for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));
