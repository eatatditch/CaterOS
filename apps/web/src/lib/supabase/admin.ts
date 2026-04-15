import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

/**
 * Returns a service-role admin client if SUPABASE_SERVICE_ROLE_KEY is
 * configured, otherwise null. Callers must handle the null case — never
 * throw on missing credentials, since many surfaces (dashboard, deal
 * detail, contact detail) only _optionally_ use the admin client.
 */
export function tryCreateAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';
  if (!key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Stricter variant — throws if the service role key is missing.
 * Use only from code paths where the caller is about to do something that
 * REQUIRES the admin client (OAuth callbacks, webhooks, lead capture).
 */
export function createAdminClient() {
  const client = tryCreateAdminClient();
  if (!client) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY). Set it in Vercel → Settings → Environment Variables.',
    );
  }
  return client;
}
