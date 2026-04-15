-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · lead form — extended fields (event date/time, service type,
-- location), auto-create tentative events, public form_meta RPC.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.capture_lead(
  text, text, text, text, text, text, timestamptz, int, text, text
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
  p_source text default 'web_form'
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
  v_event_ts_end timestamptz;
  v_service_enum service_type;
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
    p_source,
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

  if v_event_ts is not null then
    v_event_ts_end := v_event_ts + interval '3 hours';
    insert into events (
      org_id, location_id, contact_id, owner_id, name, status, service_type,
      headcount, starts_at, ends_at, notes
    ) values (
      v_org_id, p_location_id, v_contact_id, v_owner_id,
      coalesce(trim(p_first_name || ' ' || coalesce(p_last_name, '')), 'Inbound lead') || ' event',
      'tentative',
      coalesce(v_service_enum, 'delivery'::service_type),
      coalesce(p_headcount, 0),
      v_event_ts,
      v_event_ts_end,
      p_message
    );
  end if;

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

create or replace function public.form_meta(p_org_slug text)
returns jsonb language sql stable security definer set search_path = public
as $$
  with o as (select id, name, currency, timezone from orgs where slug = p_org_slug),
  locs as (
    select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by is_default desc, name) as arr
    from locations
    where org_id = (select id from o)
  )
  select jsonb_build_object(
    'org', jsonb_build_object('name', (select name from o), 'slug', p_org_slug),
    'locations', coalesce((select arr from locs), '[]'::jsonb)
  );
$$;

grant execute on function public.form_meta(text) to anon, authenticated, service_role;
