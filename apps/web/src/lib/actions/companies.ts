'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  domain: z.string().trim().max(120).optional().or(z.literal('')),
  industry: z.string().trim().max(120).optional().or(z.literal('')),
  website: z.string().trim().max(240).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  region: z.string().trim().max(80).optional().or(z.literal('')),
});

export async function createCompany(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { data, error } = await supabase
    .from('companies')
    .insert({ ...payload, org_id: ctx.org.id, owner_id: ctx.user.id })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app/companies');
  redirect(`/app/companies/${data.id}`);
}

export async function updateCompany(id: string, formData: FormData) {
  await requireCurrent();
  const parsed = schema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('companies').update(payload).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/companies');
  revalidatePath(`/app/companies/${id}`);
  return { ok: true };
}
