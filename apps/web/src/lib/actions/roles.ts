'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type MemberRole,
  type Permission,
  type RolePermissionOverrides,
} from '@cateros/lib/auth';

const EDITABLE_ROLES: MemberRole[] = ['manager', 'sales', 'ops', 'driver', 'read_only'];

export async function updateRolePermissions(formData: FormData) {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner') {
    return { error: 'Only the owner can change role permissions.' };
  }

  const next: RolePermissionOverrides = {};
  for (const role of EDITABLE_ROLES) {
    const overrides: Partial<Record<Permission, boolean>> = {};
    for (const perm of ALL_PERMISSIONS) {
      const key = `${role}.${perm}`;
      const granted = formData.get(key) === 'on';
      const defaultGranted = DEFAULT_ROLE_PERMISSIONS[role].includes(perm);
      if (granted !== defaultGranted) overrides[perm] = granted;
    }
    if (Object.keys(overrides).length > 0) next[role] = overrides;
  }

  const supabase = await createClient();
  const { data: org, error: readErr } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();
  if (readErr) return { error: readErr.message };

  const settings = ((org?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  settings.role_permissions = next;

  const { error } = await supabase
    .from('orgs')
    .update({ settings })
    .eq('id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app', 'layout');
  return { ok: true };
}

export async function resetRolePermissions() {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner') {
    return { error: 'Only the owner can reset role permissions.' };
  }
  const supabase = await createClient();
  const { data: org, error: readErr } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();
  if (readErr) return { error: readErr.message };

  const settings = ((org?.settings as Record<string, unknown>) ?? {}) as Record<string, unknown>;
  delete settings.role_permissions;

  const { error } = await supabase
    .from('orgs')
    .update({ settings })
    .eq('id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app', 'layout');
  return { ok: true };
}
