'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  deposit_rate: z.number().min(0).max(1).optional(),
  auto_charge_enabled: z.boolean().optional(),
});

export async function saveBillingSettings(input: z.infer<typeof schema>) {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners and managers can change billing settings.' };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid billing settings' };

  const supabase = await createClient();
  const { data: org } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();
  const current = (org?.settings as Record<string, unknown> | null) ?? {};
  const next: Record<string, unknown> = { ...current };
  if (parsed.data.deposit_rate !== undefined) next.deposit_rate = parsed.data.deposit_rate;
  if (parsed.data.auto_charge_enabled !== undefined)
    next.auto_charge_enabled = parsed.data.auto_charge_enabled;

  const { error } = await supabase.from('orgs').update({ settings: next }).eq('id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app/billing');
  return { ok: true };
}

// Kept for backwards-compat with the existing UI
export async function saveDepositRate(input: { deposit_rate: number }) {
  return saveBillingSettings({ deposit_rate: input.deposit_rate });
}
