'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { tryCreateAdminClient } from '@/lib/supabase/admin';
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

// ─── Event staffing ─────────────────────────────────────────────────────────
// Assign org members to an event with a role label, optional call time, and an
// hourly rate (entered in dollars, stored as integer cents + currency). Writes
// are gated to ops+ via the events.manage permission and always stamp org_id.

const staffSchema = z.object({
  user_id: z.string().uuid().optional().or(z.literal('')),
  role: z.string().trim().min(1, 'Role is required').max(100),
  call_time: z.string().optional().or(z.literal('')),
  release_time: z.string().optional().or(z.literal('')),
  hourly_rate: z.coerce.number().min(0).optional(),
});

export async function assignEventStaff(eventId: string, formData: FormData) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, org_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return { error: 'Event not found.' };

  const { user_id, role, call_time, release_time, hourly_rate } = parsed.data;
  const { error } = await supabase.from('event_staff').insert({
    event_id: eventId,
    org_id: event.org_id,
    user_id: user_id ? user_id : null,
    role: role.trim(),
    call_time: call_time ? call_time : null,
    release_time: release_time ? release_time : null,
    hourly_rate_cents:
      hourly_rate === undefined || Number.isNaN(hourly_rate)
        ? null
        : Math.round(hourly_rate * 100),
    currency: ctx.org.currency,
  });
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${eventId}`);
  return { ok: true };
}

export async function updateEventStaff(staffId: string, formData: FormData) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const parsed = staffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('event_staff')
    .select('id, event_id')
    .eq('id', staffId)
    .maybeSingle();
  if (!staff) return { error: 'Staff assignment not found.' };

  const { user_id, role, call_time, release_time, hourly_rate } = parsed.data;
  const { error } = await supabase
    .from('event_staff')
    .update({
      user_id: user_id ? user_id : null,
      role: role.trim(),
      call_time: call_time ? call_time : null,
      release_time: release_time ? release_time : null,
      hourly_rate_cents:
        hourly_rate === undefined || Number.isNaN(hourly_rate)
          ? null
          : Math.round(hourly_rate * 100),
    })
    .eq('id', staffId);
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${staff.event_id}`);
  return { ok: true };
}

export async function removeEventStaff(staffId: string) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const supabase = await createClient();

  const { data: staff } = await supabase
    .from('event_staff')
    .select('id, event_id')
    .eq('id', staffId)
    .maybeSingle();
  if (!staff) return { error: 'Staff assignment not found.' };

  const { error } = await supabase.from('event_staff').delete().eq('id', staffId);
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${staff.event_id}`);
  return { ok: true };
}

/**
 * Delete an event (calendar + dispatch). Clears staff and BEO records via FK
 * cascade (they ref events(id) on delete cascade). Idempotent if the id
 * doesn't exist.
 */
export async function deleteEvent(id: string) {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) return { error: error.message };

  const admin = tryCreateAdminClient();
  if (admin) {
    await admin.from('audit_logs').insert({
      org_id: ctx.org.id,
      actor_id: ctx.user.id,
      action: 'delete',
      entity: 'event',
      entity_id: id,
    });
  }

  revalidatePath('/app/events');
  revalidatePath('/app/dispatch');
  return { ok: true };
}
