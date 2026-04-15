-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · team management, public web forms, pipeline simplification
-- ════════════════════════════════════════════════════════════════════════════

-- Remove "Qualified" from existing pipelines
with qualified_stages as (
  select s.id as stage_id, s.pipeline_id from stages s where s.name = 'Qualified'
),
lead_stages as (
  select s.id as stage_id, s.pipeline_id from stages s where s.name = 'Lead'
)
update deals d
set stage_id = l.stage_id
from qualified_stages q
join lead_stages l on l.pipeline_id = q.pipeline_id
where d.stage_id = q.stage_id;

delete from stages where name = 'Qualified';

with ranked as (
  select id, pipeline_id, row_number() over (partition by pipeline_id order by position) - 1 as new_pos
  from stages
)
update stages s set position = r.new_pos from ranked r where r.id = s.id;

create or replace function public.seed_default_pipeline()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_pipeline_id uuid;
begin
  insert into public.pipelines (org_id, name, is_default) values (new.id, 'Sales Pipeline', true) returning id into v_pipeline_id;
  insert into public.stages (pipeline_id, name, position, probability, is_won, is_lost) values
    (v_pipeline_id, 'Lead',      0, 15,  false, false),
    (v_pipeline_id, 'Proposal',  1, 50,  false, false),
    (v_pipeline_id, 'Booked',    2, 90,  false, false),
    (v_pipeline_id, 'Delivered', 3, 100, true,  false),
    (v_pipeline_id, 'Lost',      4, 0,   false, true);
  return new;
end;
$$;

-- invitations
create table invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  email citext not null,
  role member_role not null default 'sales',
  token text not null unique,
  invited_by uuid references profiles(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index on invitations(org_id);
create index on invitations(email);
create unique index invitations_open_email_per_org
  on invitations(org_id, email) where accepted_at is null;

alter table invitations enable row level security;
create policy "tenant read invitations" on invitations for select
  using (org_id in (select public.user_org_ids()));
create policy "managers write invitations" on invitations for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

-- handle_new_user: auto-attach pending invitations on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_slug text;
  v_full_name text;
  v_invite record;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  insert into public.profiles (id, full_name) values (new.id, v_full_name);

  for v_invite in
    select id, org_id, role from public.invitations
    where email = new.email and accepted_at is null and expires_at > now()
  loop
    insert into public.memberships (org_id, user_id, role) values (v_invite.org_id, new.id, v_invite.role)
    on conflict (org_id, user_id) do update set role = excluded.role;
    update public.invitations set accepted_at = now() where id = v_invite.id;
  end loop;

  if not exists (select 1 from public.memberships where user_id = new.id) then
    v_org_name := coalesce(new.raw_user_meta_data->>'org_name', v_full_name || '''s Catering');
    v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 6);
    insert into public.orgs (name, slug) values (v_org_name, v_slug) returning id into v_org_id;
    insert into public.memberships (org_id, user_id, role) values (v_org_id, new.id, 'owner');
    insert into public.locations (org_id, name, is_default) values (v_org_id, 'Main Kitchen', true);
  end if;

  return new;
end;
$$;

-- lead auto-assignment
create or replace function public.pick_lead_owner(target_org uuid)
returns uuid language sql stable security definer set search_path = public
as $$
  with candidates as (
    select m.user_id, m.role,
           (select count(*) from deals d where d.owner_id = m.user_id and d.closed_at is null) as open_deals
    from memberships m
    where m.org_id = target_org and m.role in ('owner', 'manager', 'sales')
  )
  select user_id from candidates
  order by case role when 'manager' then 0 when 'sales' then 1 when 'owner' then 2 else 3 end,
           open_deals asc, user_id asc
  limit 1;
$$;

-- public lead capture RPC (invoked from Next.js API route using service-role)
create or replace function public.capture_lead(
  p_org_slug text, p_first_name text, p_last_name text, p_email text,
  p_phone text, p_company text, p_event_date timestamptz, p_headcount int,
  p_message text, p_source text default 'web_form'
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_org_id uuid; v_contact_id uuid; v_company_id uuid;
  v_pipeline_id uuid; v_stage_id uuid; v_owner_id uuid; v_deal_id uuid;
begin
  select id into v_org_id from orgs where slug = p_org_slug;
  if v_org_id is null then raise exception 'org_not_found'; end if;

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

  insert into deals (org_id, pipeline_id, stage_id, contact_id, company_id, owner_id, title, source, expected_close_date)
  values (v_org_id, v_pipeline_id, v_stage_id, v_contact_id, v_company_id, v_owner_id,
    coalesce(trim(p_first_name || ' ' || coalesce(p_last_name, '')), p_email) ||
      case when p_event_date is not null then ' · ' || to_char(p_event_date, 'Mon DD') else '' end ||
      case when p_headcount > 0 then ' · ' || p_headcount || ' pax' else '' end,
    p_source, p_event_date)
  returning id into v_deal_id;

  if p_message is not null and length(trim(p_message)) > 0 then
    insert into activities (org_id, type, contact_id, deal_id, subject, body, meta)
    values (v_org_id, 'note', v_contact_id, v_deal_id, 'Inbound web form', p_message,
            jsonb_build_object('headcount', p_headcount, 'event_date', p_event_date, 'source', p_source));
  end if;

  return v_deal_id;
end;
$$;

grant execute on function public.capture_lead(text, text, text, text, text, text, timestamptz, int, text, text) to service_role;
grant execute on function public.pick_lead_owner(uuid) to authenticated;
