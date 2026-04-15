'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCurrent } from '@/lib/auth/current';

const roleEnum = z.enum(['owner', 'manager', 'sales', 'ops', 'driver', 'read_only']);

function randToken() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function managerGate(role: string) {
  if (role !== 'owner' && role !== 'manager') {
    return 'Only owners and managers can manage the team.';
  }
  return null;
}

const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: roleEnum,
});

export async function inviteMember(formData: FormData) {
  const ctx = await requireCurrent();
  const gate = managerGate(ctx.role);
  if (gate) return { error: gate };

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  // Only owners may invite owners
  if (parsed.data.role === 'owner' && ctx.role !== 'owner') {
    return { error: 'Only owners may invite owners.' };
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Is this email already a member?
  const { data: existing } = await admin
    .from('memberships')
    .select('user_id, profiles:user_id (id)')
    .eq('org_id', ctx.org.id);
  // Not checking against email directly here since memberships lacks email; we'll rely on
  // the invitations unique-per-org constraint and handle_new_user trigger linking on signup.

  const token = randToken();

  const { error } = await supabase.from('invitations').insert({
    org_id: ctx.org.id,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
    invited_by: ctx.user.id,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: 'There is already a pending invitation for this email.' };
    }
    return { error: error.message };
  }

  // Send invitation email via Supabase Auth invite flow (creates user shell if new,
  // emails a magic link to /signup with metadata).
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  try {
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${appUrl}/invite/${token}`,
      data: { org_name: ctx.org.name, invite_token: token },
    });
  } catch (e) {
    console.warn('[inviteMember] inviteUserByEmail failed', e);
    // Non-fatal — the invitation row is still written; admin can share the link manually.
  }

  const inviteUrl = `${appUrl}/invite/${token}`;
  revalidatePath('/app/settings/team');
  return { ok: true, inviteUrl };
}

export async function revokeInvitation(id: string) {
  const ctx = await requireCurrent();
  const gate = managerGate(ctx.role);
  if (gate) return { error: gate };
  const supabase = await createClient();
  const { error } = await supabase.from('invitations').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/team');
  return { ok: true };
}

const changeSchema = z.object({ role: roleEnum });

export async function changeMemberRole(userId: string, formData: FormData) {
  const ctx = await requireCurrent();
  const gate = managerGate(ctx.role);
  if (gate) return { error: gate };
  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Invalid role' };

  if (parsed.data.role === 'owner' && ctx.role !== 'owner') {
    return { error: 'Only owners may promote to owner.' };
  }
  if (userId === ctx.user.id && parsed.data.role !== ctx.role) {
    return { error: 'You can\u2019t change your own role.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('memberships')
    .update({ role: parsed.data.role })
    .eq('org_id', ctx.org.id)
    .eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/team');
  return { ok: true };
}

export async function removeMember(userId: string) {
  const ctx = await requireCurrent();
  const gate = managerGate(ctx.role);
  if (gate) return { error: gate };
  if (userId === ctx.user.id) return { error: 'You can\u2019t remove yourself.' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('org_id', ctx.org.id)
    .eq('user_id', userId);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/team');
  return { ok: true };
}
