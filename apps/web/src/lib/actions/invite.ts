'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  token: z.string().min(8),
  password: z.string().min(8).max(128),
});

/**
 * Activates an invited teammate's account in a single step:
 *   1. Validate the token.
 *   2. Create the auth user (or reset the password on an existing shell).
 *   3. Sign them in with that password (sets the session cookie).
 *   4. Upsert membership + mark invitation accepted.
 *   5. Redirect to /welcome to fill in name/phone.
 *
 * No Supabase confirmation email, no magic-link round-trip, no /signup detour.
 */
export async function setInvitePassword(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Password must be at least 8 characters.' };

  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from('invitations')
    .select('id, org_id, email, role, expires_at, accepted_at')
    .eq('token', parsed.data.token)
    .maybeSingle();
  if (!invitation) return { error: 'Invitation not found.' };
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    return { error: 'This invitation has expired.' };
  }

  const email = invitation.email.toLowerCase();

  // Does an auth user already exist for this email? (shell user from a
  // previous Supabase fallback, or a prior invite attempt)
  const { data: existingId } = await admin.rpc('find_auth_user_id_by_email', {
    p_email: email,
  });

  let userId: string | null = (existingId as string | null) ?? null;

  if (userId) {
    const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
      password: parsed.data.password,
      email_confirm: true,
    });
    if (pwErr) return { error: pwErr.message };
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { invite_token: parsed.data.token },
    });
    if (createErr || !created.user) {
      return { error: createErr?.message ?? 'Could not create account.' };
    }
    userId = created.user.id;
  }

  // Write membership + mark invitation accepted before signing in so the
  // dashboard has what it needs on first load.
  await admin
    .from('memberships')
    .upsert(
      { org_id: invitation.org_id, user_id: userId, role: invitation.role },
      { onConflict: 'org_id,user_id' },
    );
  if (!invitation.accepted_at) {
    await admin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);
  }

  // Sign them in on the server — this sets the session cookie.
  const supabase = await createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });
  if (signInErr) return { error: signInErr.message };

  redirect('/welcome');
}
