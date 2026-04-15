-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Phase 0 · Multi-tenant foundation
-- Orgs, locations, profiles, memberships, audit log, RLS helpers
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ─── Enums ────────────────────────────────────────────────────────────────
create type member_role as enum (
  'owner', 'manager', 'sales', 'ops', 'driver', 'read_only'
);

-- ─── orgs ─────────────────────────────────────────────────────────────────
create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'America/New_York',
  currency text not null default 'USD',
  logo_url text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── locations ────────────────────────────────────────────────────────────
create table locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country text default 'US',
  timezone text,
  phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on locations(org_id);

-- ─── profiles (1:1 with auth.users) ───────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── memberships (user ↔ org with role) ───────────────────────────────────
create table memberships (
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'sales',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on memberships(user_id);

-- ─── audit_logs ───────────────────────────────────────────────────────────
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  diff jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);
create index on audit_logs(org_id, created_at desc);

-- ════════════════════════════════════════════════════════════════════════════
-- RLS helper functions (SECURITY DEFINER, schema-qualified, immutable per call)
-- ════════════════════════════════════════════════════════════════════════════

-- Returns the set of org_ids the current auth user belongs to.
create or replace function public.user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from memberships where user_id = auth.uid();
$$;

-- Convenience: is the current user a member of org X?
create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where user_id = auth.uid() and org_id = target_org
  );
$$;

-- Returns the role of the current user in org X (or null).
create or replace function public.user_role_in_org(target_org uuid)
returns member_role
language sql
stable
security definer
set search_path = public
as $$
  select role from memberships
  where user_id = auth.uid() and org_id = target_org
  limit 1;
$$;

create or replace function public.has_org_role(target_org uuid, required member_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with rank as (
    select case required
      when 'owner'     then 100
      when 'manager'   then 80
      when 'sales'     then 60
      when 'ops'       then 50
      when 'driver'    then 30
      when 'read_only' then 10
    end as required_rank
  ),
  actual as (
    select case (select role from memberships
                 where user_id = auth.uid() and org_id = target_org limit 1)
      when 'owner'     then 100
      when 'manager'   then 80
      when 'sales'     then 60
      when 'ops'       then 50
      when 'driver'    then 30
      when 'read_only' then 10
      else 0
    end as actual_rank
  )
  select (select actual_rank from actual) >= (select required_rank from rank);
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- updated_at trigger
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger set_updated_at before update on orgs
  for each row execute function public.tg_set_updated_at();
create trigger set_updated_at before update on profiles
  for each row execute function public.tg_set_updated_at();

-- ════════════════════════════════════════════════════════════════════════════
-- Auto-provision profile + org on signup
-- Reads org_name + full_name from raw_user_meta_data; creates org & owner membership.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_slug text;
  v_full_name text;
begin
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_org_name  := coalesce(new.raw_user_meta_data->>'org_name', v_full_name || '''s Catering');

  insert into public.profiles (id, full_name)
  values (new.id, v_full_name);

  v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(new.id::text, 1, 6);

  insert into public.orgs (name, slug)
  values (v_org_name, v_slug)
  returning id into v_org_id;

  insert into public.memberships (org_id, user_id, role)
  values (v_org_id, new.id, 'owner');

  insert into public.locations (org_id, name, is_default)
  values (v_org_id, 'Main Kitchen', true);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════
alter table orgs enable row level security;
alter table locations enable row level security;
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table audit_logs enable row level security;

-- orgs
create policy "members can read their orgs"
  on orgs for select
  using (id in (select public.user_org_ids()));

create policy "owners/managers can update their org"
  on orgs for update
  using (public.has_org_role(id, 'manager'))
  with check (public.has_org_role(id, 'manager'));

-- locations
create policy "members can read locations"
  on locations for select
  using (org_id in (select public.user_org_ids()));

create policy "managers can write locations"
  on locations for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

-- profiles: a user can read/update only themselves; org-mates can read names
create policy "user can read own profile"
  on profiles for select
  using (id = auth.uid());

create policy "org-mates can read each other's profile"
  on profiles for select
  using (
    id in (
      select user_id from memberships
      where org_id in (select public.user_org_ids())
    )
  );

create policy "user can update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- memberships
create policy "members can read memberships of their orgs"
  on memberships for select
  using (org_id in (select public.user_org_ids()));

create policy "managers can manage memberships"
  on memberships for all
  using (public.has_org_role(org_id, 'manager'))
  with check (public.has_org_role(org_id, 'manager'));

-- audit_logs (read-only for members)
create policy "members can read audit logs of their orgs"
  on audit_logs for select
  using (org_id in (select public.user_org_ids()));
