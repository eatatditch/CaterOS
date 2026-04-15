'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const activityTypes = ['note', 'call', 'email', 'meeting', 'task', 'sms', 'event_log'] as const;

const schema = z.object({
  type: z.enum(activityTypes),
  subject: z.string().trim().max(200).optional().or(z.literal('')),
  body: z.string().trim().max(4000).optional().or(z.literal('')),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  deal_id: z.string().uuid().optional().or(z.literal('')),
  company_id: z.string().uuid().optional().or(z.literal('')),
  due_at: z.string().optional().or(z.literal('')),
});

export async function createActivity(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('activities').insert({
    ...payload,
    org_id: ctx.org.id,
    owner_id: ctx.user.id,
  });
  if (error) return { error: error.message };

  if (parsed.data.contact_id) revalidatePath(`/app/contacts/${parsed.data.contact_id}`);
  if (parsed.data.deal_id) revalidatePath(`/app/deals/${parsed.data.deal_id}`);
  return { ok: true };
}

export async function completeActivity(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  await supabase.from('activities').update({ completed_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/app', 'layout');
  return { ok: true };
}
