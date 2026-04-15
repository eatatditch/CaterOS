'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg, sendEmail } from '@/lib/gmail/client';

const sendSchema = z.object({
  contact_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20000),
  cc: z.string().optional().nullable(),
});

export async function sendContactEmail(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = sendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const connection = await getConnectionForOrg(ctx.org.id);
  if (!connection) {
    return {
      error:
        'No Gmail account connected. Connect one in Settings → Integrations first.',
    };
  }

  try {
    const sent = await sendEmail(connection, {
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
      cc: parsed.data.cc ?? undefined,
    });

    // Log as activity in the contact's timeline
    const admin = createAdminClient();
    await admin.from('activities').insert({
      org_id: ctx.org.id,
      type: 'email',
      contact_id: parsed.data.contact_id,
      owner_id: ctx.user.id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      meta: {
        gmail_message_id: sent.id,
        gmail_thread_id: sent.threadId,
        to: parsed.data.to,
        from: connection.email,
        outbound: true,
      },
    });

    revalidatePath(`/app/contacts/${parsed.data.contact_id}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send';
    return { error: msg };
  }
}

export async function disconnectGmail() {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners/managers can disconnect Gmail.' };
  }
  const admin = createAdminClient();
  const { error } = await admin.from('gmail_connections').delete().eq('org_id', ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/integrations');
  return { ok: true };
}
