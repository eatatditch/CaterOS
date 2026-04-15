-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Marketing automation — segments, campaigns, sequences
-- ════════════════════════════════════════════════════════════════════════════

create type segment_kind as enum ('dynamic', 'manual');

create table if not exists segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  kind segment_kind not null default 'dynamic',
  filters jsonb not null default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists segments_org_idx on segments(org_id);

create table if not exists segment_members (
  segment_id uuid not null references segments(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (segment_id, contact_id)
);

create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'cancelled');

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text,
  segment_id uuid references segments(id) on delete set null,
  status campaign_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  sent_count int not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_org_idx on campaigns(org_id, created_at desc);

create table if not exists campaign_sends (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'queued',
  sent_at timestamptz,
  error text,
  gmail_message_id text,
  unique (campaign_id, contact_id)
);
create index if not exists campaign_sends_campaign_idx on campaign_sends(campaign_id);

create type sequence_trigger as enum (
  'inbound_lead','quote_sent','quote_accepted','event_completed',
  'annual_rebook','abandoned_quote','manual'
);
create type sequence_status as enum ('draft', 'active', 'paused');

create table if not exists sequences (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  description text,
  trigger sequence_trigger not null default 'manual',
  status sequence_status not null default 'draft',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sequences_org_idx on sequences(org_id);

create table if not exists sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  position int not null default 0,
  delay_hours int not null default 0,
  subject text not null,
  body_html text not null,
  body_text text,
  created_at timestamptz not null default now()
);
create index if not exists sequence_steps_seq_idx on sequence_steps(sequence_id, position);

create table if not exists sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  sequence_id uuid not null references sequences(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  current_step int not null default 0,
  next_send_at timestamptz,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (sequence_id, contact_id)
);
create index if not exists sequence_enrollments_next_idx on sequence_enrollments(next_send_at)
  where status = 'active';

create trigger set_updated_at before update on segments
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on campaigns
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on sequences
  for each row execute function public.tg_set_updated_at();

alter table segments            enable row level security;
alter table segment_members     enable row level security;
alter table campaigns           enable row level security;
alter table campaign_sends      enable row level security;
alter table sequences           enable row level security;
alter table sequence_steps      enable row level security;
alter table sequence_enrollments enable row level security;

create policy "tenant read" on segments for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on segments for all using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));
create policy "tenant read" on segment_members for select using (segment_id in (select id from segments where org_id in (select public.user_org_ids())));
create policy "sales write" on segment_members for all using (segment_id in (select id from segments where public.has_org_role(org_id, 'sales'))) with check (segment_id in (select id from segments where public.has_org_role(org_id, 'sales')));
create policy "tenant read" on campaigns for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on campaigns for all using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));
create policy "tenant read" on campaign_sends for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on campaign_sends for all using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));
create policy "tenant read" on sequences for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on sequences for all using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));
create policy "tenant read" on sequence_steps for select using (sequence_id in (select id from sequences where org_id in (select public.user_org_ids())));
create policy "sales write" on sequence_steps for all using (sequence_id in (select id from sequences where public.has_org_role(org_id, 'sales'))) with check (sequence_id in (select id from sequences where public.has_org_role(org_id, 'sales')));
create policy "tenant read" on sequence_enrollments for select using (org_id in (select public.user_org_ids()));
create policy "sales write" on sequence_enrollments for all using (public.has_org_role(org_id, 'sales')) with check (public.has_org_role(org_id, 'sales'));

create or replace function public.segment_contacts(p_segment_id uuid)
returns setof uuid language plpgsql stable security definer set search_path = public
as $$
declare v_seg segments%rowtype;
begin
  select * into v_seg from segments where id = p_segment_id;
  if not found then return; end if;
  if v_seg.kind = 'manual' then
    return query select contact_id from segment_members where segment_id = v_seg.id;
    return;
  end if;
  return query
    select c.id from contacts c
    where c.org_id = v_seg.org_id
      and (v_seg.filters ? 'lifecycle_stage' = false or c.lifecycle_stage::text = any (select jsonb_array_elements_text(v_seg.filters->'lifecycle_stage')))
      and (v_seg.filters ? 'lead_source' = false or c.lead_source = any (select jsonb_array_elements_text(v_seg.filters->'lead_source')))
      and (v_seg.filters ? 'owner_id' = false or c.owner_id::text = v_seg.filters->>'owner_id')
      and (v_seg.filters ? 'tags_any' = false or c.tags && (select array_agg(value) from jsonb_array_elements_text(v_seg.filters->'tags_any')))
      and (v_seg.filters ? 'created_after' = false or c.created_at >= (v_seg.filters->>'created_after')::timestamptz)
      and (v_seg.filters ? 'created_before' = false or c.created_at <= (v_seg.filters->>'created_before')::timestamptz);
end;
$$;

grant execute on function public.segment_contacts(uuid) to authenticated, service_role;
