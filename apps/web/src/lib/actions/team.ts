'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg, sendEmail } from '@/lib/gmail/client';

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

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

// Sends the invite email via the org's connected Gmail. If Gmail isn't
// connected we return null and the caller shows the copy-link UX — we do
// NOT fall back to Supabase's inviteUserByEmail because that sends a
// Supabase-branded magic link that routes through Supabase's hosted
// confirmation UI and asks the invitee for a code.
async function deliverInviteEmail(opts: {
  orgId: string;
  orgName: string;
  inviterName: string | null;
  email: string;
  role: string;
  token: string;
}): Promise<'gmail' | null> {
  const inviteUrl = `${appBaseUrl()}/invite/${opts.token}`;
  const roleLabel = opts.role.replace('_', ' ');
  const inviter = opts.inviterName ?? 'Your teammate';
  const subject = `You've been invited to ${opts.orgName} on CaterOS`;
  const textBody = [
    `${inviter} invited you to join ${opts.orgName} on CaterOS as ${roleLabel}.`,
    '',
    'Accept the invite and set your password:',
    inviteUrl,
    '',
    "If you didn't expect this email, you can safely ignore it.",
  ].join('\n');
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 12px;">You're invited to ${opts.orgName}</h2>
      <p style="margin: 0 0 16px; color: #555;">
        ${inviter} invited you to join <strong>${opts.orgName}</strong> on CaterOS as <strong>${roleLabel}</strong>.
      </p>
      <p style="margin: 24px 0;">
        <a href="${inviteUrl}" style="display:inline-block; background:#0f766e; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:500;">
          Accept invite & set password
        </a>
      </p>
      <p style="margin: 16px 0 0; color:#888; font-size:12px;">
        Or paste this link into your browser:<br><span style="color:#555;">${inviteUrl}</span>
      </p>
    </div>
  `;

  const connection = await getConnectionForOrg(opts.orgId);
  if (connection) {
    try {
      await sendEmail(connection, { to: opts.email, subject, textBody, htmlBody });
      return 'gmail';
    } catch (err) {
      console.warn('[invite] Gmail send failed', err);
    }
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

  if (parsed.data.role === 'owner' && ctx.role !== 'owner') {
    return { error: 'Only owners may invite owners.' };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
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
      return {
        error:
          'There is already a pending invitation for this email — use the Resend button on that row to send a new link.',
      };
    }
    return { error: error.message };
  }

  const { data: inviter } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.user.id)
    .maybeSingle();

  const channel = await deliverInviteEmail({
    orgId: ctx.org.id,
    orgName: ctx.org.name,
    inviterName: inviter?.full_name ?? null,
    email: parsed.data.email,
    role: parsed.data.role,
    token,
  });

  const inviteUrl = `${appBaseUrl()}/invite/${token}`;
  revalidatePath('/app/settings/team');
  return { ok: true, inviteUrl, emailed: channel };
}

export async function resendInvitation(id: string) {
  const ctx = await requireCurrent();
  const gate = managerGate(ctx.role);
  if (gate) return { error: gate };

  const admin = createAdminClient();
  const { data: existing, error: readErr } = await admin
    .from('invitations')
    .select('id, email, role, org_id, accepted_at')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!existing) return { error: 'Invitation not found.' };
  if (existing.accepted_at) return { error: 'This invitation has already been accepted.' };

  const newToken = randToken();
  const newExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error: upErr } = await admin
    .from('invitations')
    .update({ token: newToken, expires_at: newExpiry })
    .eq('id', id);
  if (upErr) return { error: upErr.message };

  const { data: inviter } = await admin
    .from('profiles')
    .select('full_name')
    .eq('id', ctx.user.id)
    .maybeSingle();

  const channel = await deliverInviteEmail({
    orgId: ctx.org.id,
    orgName: ctx.org.name,
    inviterName: inviter?.full_name ?? null,
    email: existing.email,
    role: existing.role,
    token: newToken,
  });

  const inviteUrl = `${appBaseUrl()}/invite/${newToken}`;
  revalidatePath('/app/settings/team');
  return { ok: true, inviteUrl, emailed: channel };
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
