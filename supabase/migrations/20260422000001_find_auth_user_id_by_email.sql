-- Lets us look up an auth user's id by email from the service role.
-- Used by the invite-acceptance flow to decide whether to create a new
-- auth user or reset the password on an existing shell user.
create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = public, auth
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
