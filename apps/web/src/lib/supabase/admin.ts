import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from './env';

/**
 * Service-role admin client. ONLY use from server routes where you need to
 * bypass RLS (webhooks, public API endpoints, invite flows).
 * Never expose in a client component or edge middleware.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY ?? '';
  if (!key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY). Set it in Vercel → Settings → Environment Variables.',
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
