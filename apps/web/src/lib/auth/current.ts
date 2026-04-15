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

  const { data: membership } = await supabase
    .from('memberships')
    .select('role, orgs:org_id (id, name, slug, timezone, currency)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !membership.orgs) return null;

  const org = membership.orgs as unknown as CurrentContext['org'];
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
