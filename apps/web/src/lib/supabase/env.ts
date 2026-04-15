/**
 * Supabase env-var resolution.
 *
 * Browser code can ONLY read NEXT_PUBLIC_* vars (they get inlined at build time).
 * Server code can read both — so we fall back to unprefixed names for
 * compatibility with Vercel's Supabase marketplace integration, which sets
 * vars like SUPABASE_URL / SUPABASE_ANON_KEY without the NEXT_PUBLIC_ prefix.
 *
 * During static generation at build time, neither may be present — we return
 * placeholder values so the module load doesn't throw; the routes that call
 * into Supabase are marked `dynamic = 'force-dynamic'` so prerender never
 * actually issues a request with these placeholders.
 */

const BUILD_PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const BUILD_PLACEHOLDER_KEY = 'placeholder';

export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    BUILD_PLACEHOLDER_URL
  );
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    BUILD_PLACEHOLDER_KEY
  );
}

export function hasSupabaseEnv(): boolean {
  return (
    !!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) &&
    !!(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      process.env.SUPABASE_PUBLISHABLE_KEY
    )
  );
}
