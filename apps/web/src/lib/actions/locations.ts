'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  address_line_1: z.string().trim().max(200).optional().or(z.literal('')),
  city: z.string().trim().max(80).optional().or(z.literal('')),
  region: z.string().trim().max(80).optional().or(z.literal('')),
  postal_code: z.string().trim().max(20).optional().or(z.literal('')),
  country: z.string().trim().max(80).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  timezone: z.string().trim().max(80).optional().or(z.literal('')),
});

function roleGate(role: string) {
  if (role !== 'owner' && role !== 'manager') {
    return 'Only owners and managers can manage locations.';
  }
  return null;
}

export async function createLocation(formData: FormData) {
  const ctx = await requireCurrent();
  const err = roleGate(ctx.role);
  if (err) return { error: err };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('locations').insert({
    ...payload,
    org_id: ctx.org.id,
  });
  if (error) return { error: error.message };
  revalidatePath('/app/settings/locations');
  return { ok: true };
}

export async function updateLocation(id: string, formData: FormData) {
  const ctx = await requireCurrent();
  const err = roleGate(ctx.role);
  if (err) return { error: err };
  const parsed = schema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('locations').update(payload).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/locations');
  return { ok: true };
}

export async function setDefaultLocation(id: string) {
  const ctx = await requireCurrent();
  const err = roleGate(ctx.role);
  if (err) return { error: err };
  const supabase = await createClient();
  // Unset all, then set chosen one
  await supabase.from('locations').update({ is_default: false }).eq('org_id', ctx.org.id);
  const { error } = await supabase.from('locations').update({ is_default: true }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/locations');
  return { ok: true };
}

export async function deleteLocation(id: string) {
  const ctx = await requireCurrent();
  const err = roleGate(ctx.role);
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from('locations').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/locations');
  return { ok: true };
}
