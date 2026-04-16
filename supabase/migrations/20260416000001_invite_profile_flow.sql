-- ════════════════════════════════════════════════════════════════════════════
-- Invite profile flow:
--   1. Add first_name / last_name to profiles (phone already exists).
--   2. Teach handle_new_user() to auto-attach matching pending invitations so
--      invitees join the inviting org instead of getting a blank personal org.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

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
  v_first_name text;
  v_last_name text;
  v_phone text;
  invite record;
  has_invitation boolean := false;
begin
  v_first_name := new.raw_user_meta_data->>'first_name';
  v_last_name  := new.raw_user_meta_data->>'last_name';
  v_phone      := new.raw_user_meta_data->>'phone';
  v_full_name  := coalesce(
    new.raw_user_meta_data->>'full_name',
    nullif(trim(coalesce(v_first_name, '') || ' ' || coalesce(v_last_name, '')), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, full_name, first_name, last_name, phone)
  values (new.id, v_full_name, v_first_name, v_last_name, v_phone);

  -- Attach to any pending invitations for this email — they join the inviter's org
  -- at the role specified on the invitation row, no personal org created.
  for invite in
    select i.id, i.org_id, i.role
    from public.invitations i
    where lower(i.email) = lower(new.email)
      and i.accepted_at is null
      and i.expires_at > now()
  loop
    insert into public.memberships (org_id, user_id, role)
    values (invite.org_id, new.id, invite.role)
    on conflict (org_id, user_id) do nothing;
    update public.invitations set accepted_at = now() where id = invite.id;
    has_invitation := true;
  end loop;

  if not has_invitation then
    v_org_name := coalesce(new.raw_user_meta_data->>'org_name', v_full_name || '''s Catering');
    v_slug := lower(regexp_replace(v_org_name, '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(new.id::text, 1, 6);

    insert into public.orgs (name, slug)
    values (v_org_name, v_slug)
    returning id into v_org_id;

    insert into public.memberships (org_id, user_id, role)
    values (v_org_id, new.id, 'owner');

    insert into public.locations (org_id, name, is_default)
    values (v_org_id, 'Main Kitchen', true);
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
