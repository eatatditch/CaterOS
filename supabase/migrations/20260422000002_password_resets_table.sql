-- Self-serve password reset tokens. Sent via the user's org's Gmail so the
-- email is branded (no Supabase-hosted recovery UI).
create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  email citext not null,
  token text not null unique,
  expires_at timestamptz not null default now() + interval '1 hour',
  used_at timestamptz,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists password_resets_email_idx on public.password_resets(email);
create index if not exists password_resets_token_idx on public.password_resets(token);

-- Only service_role touches this table via server actions.
alter table public.password_resets enable row level security;
-- No policies: anon / authenticated cannot read or write.
