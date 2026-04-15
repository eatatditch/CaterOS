import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { MemberRole } from '@cateros/lib/auth';

export type CurrentContext = {
  user: { id: string; email: string | null };
  org: { id: string; name: string; slug: string; timezone: string; currency: string };
  role: MemberRole;
};

type MembershipRow = {
  role: MemberRole;
  orgs:
    | { id: string; name: string; slug: string; timezone: string; currency: string }
    | { id: string; name: string; slug: string; timezone: string; currency: string }[]
    | null;
};

export const getCurrent = cache(async (): Promise<CurrentContext | null> => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel Project Settings → Environment Variables, then redeploy.',
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('memberships')
    .select('role, orgs:org_id (id, name, slug, timezone, currency)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[getCurrent] membership query failed', error);
    throw new Error(`Membership query failed: ${error.message}`);
  }
  if (!data) return null;

  const membership = data as unknown as MembershipRow;
  const orgRaw = Array.isArray(membership.orgs) ? membership.orgs[0] : membership.orgs;
  if (!orgRaw) return null;

  return {
    user: { id: user.id, email: user.email ?? null },
    org: orgRaw,
    role: membership.role,
  };
});

export async function requireCurrent(): Promise<CurrentContext> {
  const ctx = await getCurrent();
  if (!ctx) redirect('/login');
  return ctx;
}
