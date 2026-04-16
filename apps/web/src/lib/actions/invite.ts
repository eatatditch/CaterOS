'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const schema = z.object({
  token: z.string().min(8),
  password: z.string().min(8).max(128),
});

// Called from /invite/[token] after the invitee is signed in via magic link.
// Sets their password (the shell user Supabase created has a random one) and
// upserts their membership against the invitation's org + role.
export async function setInvitePassword(formData: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: 'Password must be at least 8 characters.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session expired — please re-open the invite link.' };

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
  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return { error: `This invitation is for ${invitation.email}.` };
  }

  const { error: pwErr } = await admin.auth.admin.updateUserById(user.id, {
    password: parsed.data.password,
  });
  if (pwErr) return { error: pwErr.message };

  await admin
    .from('memberships')
    .upsert(
      { org_id: invitation.org_id, user_id: user.id, role: invitation.role },
      { onConflict: 'org_id,user_id' },
    );
  if (!invitation.accepted_at) {
    await admin
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);
  }

  redirect('/welcome');
}
