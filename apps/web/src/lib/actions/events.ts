'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const serviceTypes = ['delivery', 'pickup', 'full_service', 'drop_off', 'buffet', 'plated'] as const;
const statuses = [
  'tentative',
  'confirmed',
  'in_prep',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
] as const;

const schema = z.object({
  name: z.string().trim().min(1).max(200),
  status: z.enum(statuses).default('tentative'),
  service_type: z.enum(serviceTypes).default('delivery'),
  headcount: z.coerce.number().int().min(0).default(0),
  starts_at: z.string().min(1, 'Start time required'),
  ends_at: z.string().min(1, 'End time required'),
  venue_name: z.string().trim().max(200).optional().or(z.literal('')),
  venue_address: z.string().trim().max(500).optional().or(z.literal('')),
  contact_id: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(4000).optional().or(z.literal('')),
});

export async function createEvent(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { data, error } = await supabase
    .from('events')
    .insert({ ...payload, org_id: ctx.org.id, owner_id: ctx.user.id })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app/events');
  redirect(`/app/events/${data.id}`);
}

export async function updateEvent(id: string, formData: FormData) {
  await requireCurrent();
  const parsed = schema.partial().safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const { error } = await supabase.from('events').update(payload).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/events');
  revalidatePath(`/app/events/${id}`);
  return { ok: true };
}
