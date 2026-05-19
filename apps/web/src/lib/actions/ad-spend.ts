'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';

const channels = ['meta', 'google', 'other'] as const;

const schema = z.object({
  channel: z.enum(channels),
  campaign_name: z.string().trim().max(200).optional().or(z.literal('')),
  location_id: z.string().uuid().optional().or(z.literal('')),
  spend: z.coerce.number().min(0),
  period_start: z.string().min(10),
  period_end: z.string().min(10),
});

export async function createAdSpend(formData: FormData) {
  const ctx = await requirePermission('org.manage');
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase.from('ad_spend').insert({
    org_id: ctx.org.id,
    channel: parsed.data.channel,
    campaign_name: parsed.data.campaign_name || null,
    location_id: parsed.data.location_id || null,
    spend_cents: Math.round(parsed.data.spend * 100),
    period_start: parsed.data.period_start,
    period_end: parsed.data.period_end,
    created_by: ctx.user.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/app/ad-spend');
  return { ok: true };
}

export async function deleteAdSpend(id: string) {
  await requirePermission('org.manage');
  const supabase = await createClient();
  const { error } = await supabase.from('ad_spend').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/ad-spend');
  return { ok: true };
}
