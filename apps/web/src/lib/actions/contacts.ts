'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const lifecycleStages = [
  'subscriber',
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer',
  'evangelist',
  'other',
] as const;

const contactSchema = z.object({
  first_name: z.string().trim().min(1, 'First name required').max(80),
  last_name: z.string().trim().max(80).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  job_title: z.string().trim().max(120).optional().or(z.literal('')),
  company_id: z.string().uuid().optional().or(z.literal('')),
  lifecycle_stage: z.enum(lifecycleStages).default('lead'),
  lead_source: z.string().trim().max(80).optional().or(z.literal('')),
});

export async function createContact(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  }
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { data, error } = await supabase
    .from('contacts')
    .insert({ ...payload, org_id: ctx.org.id, owner_id: ctx.user.id })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/contacts');
  redirect(`/app/contacts/${data.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  await requireCurrent();
  const parsed = contactSchema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('contacts').update(payload).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/contacts');
  revalidatePath(`/app/contacts/${id}`);
  return { ok: true };
}

export async function deleteContact(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/contacts');
  redirect('/app/contacts');
}
