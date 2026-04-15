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

export const getCurrent = cache(async (): Promise<CurrentContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Two explicit queries — no PostgREST relation embed (avoids schema-cache issues).
  const { data: membership, error: mErr } = await supabase
    .from('memberships')
    .select('role, org_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (mErr) {
    console.error('[getCurrent] memberships query failed', mErr);
    throw new Error(`memberships query failed: ${mErr.message}`);
  }
  if (!membership) return null;

  const { data: org, error: oErr } = await supabase
    .from('orgs')
    .select('id, name, slug, timezone, currency')
    .eq('id', membership.org_id)
    .maybeSingle();

  if (oErr) {
    console.error('[getCurrent] orgs query failed', oErr);
    throw new Error(`orgs query failed: ${oErr.message}`);
  }
  if (!org) return null;

  return {
    user: { id: user.id, email: user.email ?? null },
    org,
    role: membership.role as MemberRole,
  };
});

export async function requireCurrent(): Promise<CurrentContext> {
  const ctx = await getCurrent();
  if (!ctx) redirect('/login');
  return ctx;
}
