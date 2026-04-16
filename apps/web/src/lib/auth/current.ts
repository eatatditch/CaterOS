import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  can as baseCan,
  resolveRolePermissions,
  type MemberRole,
  type Permission,
  type RolePermissionOverrides,
} from '@cateros/lib/auth';

export type CurrentContext = {
  user: { id: string; email: string | null };
  org: { id: string; name: string; slug: string; timezone: string; currency: string };
  role: MemberRole;
  permissions: Set<Permission>;
  rolePermissionOverrides: RolePermissionOverrides;
  can: (perm: Permission) => boolean;
};

type OrgSettings = {
  role_permissions?: RolePermissionOverrides;
  [key: string]: unknown;
};

export const getCurrent = cache(async (): Promise<CurrentContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
    .select('id, name, slug, timezone, currency, settings')
    .eq('id', membership.org_id)
    .maybeSingle();

  if (oErr) {
    console.error('[getCurrent] orgs query failed', oErr);
    throw new Error(`orgs query failed: ${oErr.message}`);
  }
  if (!org) return null;

  const role = membership.role as MemberRole;
  const settings = ((org as { settings?: OrgSettings }).settings ?? {}) as OrgSettings;
  const overrides = settings.role_permissions ?? {};
  const permissions = resolveRolePermissions(role, overrides);

  return {
    user: { id: user.id, email: user.email ?? null },
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      currency: org.currency,
    },
    role,
    permissions,
    rolePermissionOverrides: overrides,
    can: (perm: Permission) => baseCan(role, perm, overrides),
  };
});

export async function requireCurrent(): Promise<CurrentContext> {
  const ctx = await getCurrent();
  if (!ctx) redirect('/login');
  return ctx;
}

export async function requirePermission(perm: Permission): Promise<CurrentContext> {
  const ctx = await requireCurrent();
  if (!ctx.can(perm)) redirect('/app?denied=' + encodeURIComponent(perm));
  return ctx;
}
