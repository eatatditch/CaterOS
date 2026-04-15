/**
 * Supabase env-var resolution.
 *
 * Browser code can ONLY read NEXT_PUBLIC_* vars (they get inlined at build time).
 * Server code can read both — so we fall back to unprefixed names for
 * compatibility with Vercel's Supabase marketplace integration, which sets
 * vars like SUPABASE_URL / SUPABASE_ANON_KEY without the NEXT_PUBLIC_ prefix.
 */

export function getSupabaseUrl(): string {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    '';
  if (!v) {
    throw new Error(
      'Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL (recommended) or SUPABASE_URL in Vercel → Settings → Environment Variables and redeploy.',
    );
  }
  return v;
}

export function getSupabaseAnonKey(): string {
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    '';
  if (!v) {
    throw new Error(
      'Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY (recommended), SUPABASE_ANON_KEY, or SUPABASE_PUBLISHABLE_KEY in Vercel → Settings → Environment Variables and redeploy.',
    );
  }
  return v;
}
