-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Phase 0 · Security hardening (advisor remediation)
-- - lock down search_path on tg_set_updated_at
-- - move citext out of public schema
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create schema if not exists extensions;
alter extension citext set schema extensions;
