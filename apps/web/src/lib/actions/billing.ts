'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  deposit_rate: z.number().min(0).max(1), // 0..1 (e.g. 0.25 = 25%)
});

export async function saveDepositRate(input: z.infer<typeof schema>) {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners and managers can change billing settings.' };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid deposit rate' };

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();
  const current = (org?.settings as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from('orgs')
    .update({ settings: { ...current, deposit_rate: parsed.data.deposit_rate } })
    .eq('id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app/billing');
  return { ok: true };
}
