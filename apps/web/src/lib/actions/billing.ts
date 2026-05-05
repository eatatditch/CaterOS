'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  deposit_rate: z.number().min(0).max(1).optional(),
  auto_charge_enabled: z.boolean().optional(),
});

export const MANUAL_PAYMENT_METHODS = [
  'cash',
  'check',
  'card_in_person',
  'ach',
  'other',
] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

const manualPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  received_at: z.string().datetime().optional(),
  reference: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
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

export async function recordManualPayment(input: z.infer<typeof manualPaymentSchema>) {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners and managers can record payments.' };
  }
  const parsed = manualPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid payment' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_manual_payment', {
    p_invoice_id: parsed.data.invoice_id,
    p_amount_cents: parsed.data.amount_cents,
    p_method: parsed.data.method,
    p_received_at: parsed.data.received_at ?? new Date().toISOString(),
    p_reference: parsed.data.reference ?? null,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    const messages: Record<string, string> = {
      amount_must_be_positive: 'Amount must be greater than zero.',
      invalid_method: 'Choose a valid payment method.',
      invoice_not_found: 'Invoice not found.',
      forbidden: 'You don’t have permission to record payments for this invoice.',
      invoice_not_payable: 'This invoice is void or refunded.',
      amount_exceeds_balance: 'Amount is more than the remaining balance.',
      not_authenticated: 'Sign in to record a payment.',
    };
    const key = error.message.match(/[a-z_]+/)?.[0] ?? '';
    return { error: messages[key] ?? error.message };
  }

  revalidatePath('/app/invoices');
  revalidatePath(`/app/invoices/${parsed.data.invoice_id}`);
  return { ok: true, data };
}
