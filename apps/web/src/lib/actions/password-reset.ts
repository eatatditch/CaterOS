'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConnectionForOrg, sendEmail } from '@/lib/gmail/client';

function randToken() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}

const requestSchema = z.object({
  email: z.string().trim().email(),
});

/**
 * Kicks off a password reset. Always returns {ok: true} regardless of whether
 * the email exists — we don't want to leak account enumeration. If the user
 * exists AND their org has Gmail connected, a branded email is sent; otherwise
 * it's a silent no-op (the user will just never get an email).
 */
export async function requestPasswordReset(formData: FormData) {
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Enter a valid email address.' };

  const email = parsed.data.email.toLowerCase();
  const admin = createAdminClient();

  const { data: userId } = await admin.rpc('find_auth_user_id_by_email', {
    p_email: email,
  });

  if (!userId) return { ok: true };

  const token = randToken();
  await admin.from('password_resets').insert({ email, token });

  const { data: membership } = await admin
    .from('memberships')
    .select('org_id, orgs:org_id (id, name)')
    .eq('user_id', userId as string)
    .limit(1)
    .maybeSingle();

  const orgId = membership?.org_id as string | undefined;
  const orgName =
    (membership?.orgs as unknown as { name: string } | null)?.name ?? 'CaterOS';

  if (!orgId) return { ok: true };

  const connection = await getConnectionForOrg(orgId);
  if (!connection) return { ok: true };

  const resetUrl = `${appBaseUrl()}/reset-password/${token}`;
  const subject = `Reset your ${orgName} password`;
  const textBody = [
    `Someone asked to reset the password for your ${orgName} account.`,
    '',
    'Click the link below to choose a new password. This link expires in 1 hour.',
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore the email.",
  ].join('\n');
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #111;">
      <h2 style="margin: 0 0 12px;">Reset your password</h2>
      <p style="margin: 0 0 16px; color: #555;">
        Someone asked to reset the password for your <strong>${orgName}</strong> account.
      </p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display:inline-block; background:#0f766e; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:500;">
          Choose a new password
        </a>
      </p>
      <p style="margin: 16px 0 0; color:#888; font-size:12px;">
        This link expires in 1 hour. If you didn't request this, you can ignore this email.
      </p>
      <p style="margin: 12px 0 0; color:#888; font-size:12px;">
        Or paste this link into your browser:<br><span style="color:#555;">${resetUrl}</span>
      </p>
    </div>
  `;

  try {
    await sendEmail(connection, { to: email, subject, textBody, htmlBody });
  } catch (err) {
    console.warn('[password-reset] send failed', err);
  }

  return { ok: true };
}

const completeSchema = z.object({
  token: z.string().min(8),
  password: z.string().min(8).max(128),
});

/**
 * Completes a password reset. Validates the token, updates the auth user,
 * marks the token used, and signs them in so they're dropped straight into
 * the app.
 */
export async function completePasswordReset(formData: FormData) {
  const parsed = completeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Password must be at least 8 characters.' };

  const admin = createAdminClient();
  const { data: reset } = await admin
    .from('password_resets')
    .select('id, email, expires_at, used_at')
    .eq('token', parsed.data.token)
    .maybeSingle();

  if (!reset) return { error: 'This reset link is invalid.' };
  if (reset.used_at) return { error: 'This reset link has already been used.' };
  if (new Date(reset.expires_at).getTime() < Date.now()) {
    return { error: 'This reset link has expired. Request a new one.' };
  }

  const email = (reset.email as string).toLowerCase();
  const { data: userId } = await admin.rpc('find_auth_user_id_by_email', {
    p_email: email,
  });
  if (!userId) return { error: 'Account no longer exists.' };

  const { error: pwErr } = await admin.auth.admin.updateUserById(userId as string, {
    password: parsed.data.password,
    email_confirm: true,
  });
  if (pwErr) return { error: pwErr.message };

  await admin
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', reset.id);

  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (signInErr) return { error: signInErr.message };

  redirect('/app');
}
