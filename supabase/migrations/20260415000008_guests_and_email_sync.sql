-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Guests label, email sync tables, attachment storage bucket
-- ════════════════════════════════════════════════════════════════════════════

-- Rename "pax" to "guests" in deal title generation
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
      case when coalesce(p_headcount, 0) > 0 then ' · ' || p_headcount || ' guests' else '' end,
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

update deals set title = replace(title, ' pax', ' guests') where title like '% pax%';

-- Emails synced from Gmail (for threaded view + polling without re-hitting Gmail every render)
create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  gmail_message_id text not null,
  gmail_thread_id text not null,
  contact_id uuid references contacts(id) on delete set null,
  from_address text not null,
  to_addresses text[] not null default '{}',
  cc_addresses text[] not null default '{}',
  subject text,
  snippet text,
  body_text text,
  body_html text,
  has_attachments boolean not null default false,
  direction text not null check (direction in ('inbound', 'outbound')),
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (org_id, gmail_message_id)
);
create index if not exists email_messages_contact_idx on email_messages(contact_id, sent_at desc);
create index if not exists email_messages_thread_idx on email_messages(org_id, gmail_thread_id, sent_at asc);

alter table email_messages enable row level security;
create policy "tenant read email" on email_messages for select
  using (org_id in (select public.user_org_ids()));
create policy "tenant write email" on email_messages for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));

-- Attachment metadata (files live in storage bucket 'email-attachments')
create table if not exists email_attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists email_attachments_org_idx on email_attachments(org_id, created_at desc);

alter table email_attachments enable row level security;
create policy "tenant read attachments" on email_attachments for select
  using (org_id in (select public.user_org_ids()));
create policy "sales write attachments" on email_attachments for all
  using (public.has_org_role(org_id, 'sales'))
  with check (public.has_org_role(org_id, 'sales'));

-- Storage bucket + RLS for attachments (25MB per file)
insert into storage.buckets (id, name, public, file_size_limit)
values ('email-attachments', 'email-attachments', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "tenant read email attachments" on storage.objects;
drop policy if exists "sales write email attachments" on storage.objects;
drop policy if exists "sales delete email attachments" on storage.objects;

create policy "tenant read email attachments" on storage.objects for select to authenticated
  using (bucket_id = 'email-attachments'
         and (storage.foldername(name))[1]::uuid in (select public.user_org_ids()));
create policy "sales write email attachments" on storage.objects for insert to authenticated
  with check (bucket_id = 'email-attachments'
              and public.has_org_role((storage.foldername(name))[1]::uuid, 'sales'));
create policy "sales delete email attachments" on storage.objects for delete to authenticated
  using (bucket_id = 'email-attachments'
         and public.has_org_role((storage.foldername(name))[1]::uuid, 'sales'));
