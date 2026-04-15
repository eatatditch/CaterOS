'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  amount_cents: z.coerce.number().int().min(0).default(0),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  company_id: z.string().uuid().optional().or(z.literal('')),
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  expected_close_date: z.string().optional().or(z.literal('')),
  source: z.string().trim().max(80).optional().or(z.literal('')),
});

export async function createDeal(formData: FormData) {
  const ctx = await requireCurrent();
  const raw = Object.fromEntries(formData);
  // amount field arrives as dollars; convert to cents
  const amountDollars = parseFloat(String(raw.amount ?? '0')) || 0;
  raw.amount_cents = String(Math.round(amountDollars * 100));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { data, error } = await supabase
    .from('deals')
    .insert({ ...payload, org_id: ctx.org.id, owner_id: ctx.user.id })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app/pipeline');
  redirect(`/app/deals/${data.id}`);
}

export async function updateDealStage(id: string, stageId: string) {
  await requireCurrent();
  const supabase = await createClient();
  // fetch stage to detect won/lost
  const { data: stage } = await supabase
    .from('stages')
    .select('is_won, is_lost')
    .eq('id', stageId)
    .maybeSingle();
  const patch: Record<string, unknown> = { stage_id: stageId };
  if (stage?.is_won || stage?.is_lost) patch.closed_at = new Date().toISOString();
  else patch.closed_at = null;

  const { error } = await supabase.from('deals').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/pipeline');
  revalidatePath(`/app/deals/${id}`);
  return { ok: true };
}

export async function updateDeal(id: string, formData: FormData) {
  await requireCurrent();
  const raw = Object.fromEntries(formData);
  if ('amount' in raw) {
    const amountDollars = parseFloat(String(raw.amount ?? '0')) || 0;
    raw.amount_cents = String(Math.round(amountDollars * 100));
  }
  const parsed = schema.partial().safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('deals').update(payload).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/pipeline');
  revalidatePath(`/app/deals/${id}`);
  return { ok: true };
}
