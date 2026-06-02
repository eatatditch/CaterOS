'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { hasRole } from '@cateros/lib/auth';
import { DISPATCH_STATUSES, type DispatchStatus } from '@/lib/dispatch/statuses';

const assignSchema = z.object({
  eventId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
});

const statusSchema = z.object({
  eventId: z.string().uuid(),
  status: z.enum(DISPATCH_STATUSES),
});

/**
 * Assign (or clear) the driver for an event. Gated to ops+ — drivers cannot
 * reassign work. Setting a driver moves an 'unassigned' event to 'assigned';
 * clearing the driver returns it to 'unassigned'. All scoped to the caller's
 * org (RLS also enforces this; the explicit org filter is defense in depth).
 */
export async function assignDriver(eventId: string, userId: string | null) {
  const ctx = await requireCurrent();
  if (!hasRole(ctx.role, 'ops')) {
    return { error: 'Only ops and above can assign drivers.' };
  }

  const parsed = assignSchema.safeParse({ eventId, userId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  // Validate target driver is a member of this org with a dispatchable role.
  if (parsed.data.userId) {
    const { data: membership } = await supabase
      .from('memberships')
      .select('role')
      .eq('org_id', ctx.org.id)
      .eq('user_id', parsed.data.userId)
      .maybeSingle();
    if (!membership || !['driver', 'ops', 'manager', 'owner'].includes(membership.role)) {
      return { error: 'Selected member cannot be assigned as a driver.' };
    }
  }

  // Read current dispatch status so we only nudge the unassigned/assigned edges.
  const { data: current } = await supabase
    .from('events')
    .select('dispatch_status')
    .eq('id', parsed.data.eventId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (!current) return { error: 'Event not found.' };

  const update: { driver_id: string | null; dispatch_status?: DispatchStatus } = {
    driver_id: parsed.data.userId,
  };
  if (parsed.data.userId && current.dispatch_status === 'unassigned') {
    update.dispatch_status = 'assigned';
  } else if (!parsed.data.userId) {
    update.dispatch_status = 'unassigned';
  }

  const { error } = await supabase
    .from('events')
    .update(update)
    .eq('id', parsed.data.eventId)
    .eq('org_id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app/dispatch');
  revalidatePath(`/app/events/${parsed.data.eventId}`);
  return { ok: true };
}

/**
 * Advance the dispatch status of an event. Ops+ can set any status on any org
 * event; a driver may only change the status of events assigned to them
 * (enforced here and by the "driver updates own dispatch" RLS policy).
 */
export async function setDispatchStatus(eventId: string, status: DispatchStatus) {
  const ctx = await requireCurrent();
  const parsed = statusSchema.safeParse({ eventId, status });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();

  const { data: current } = await supabase
    .from('events')
    .select('driver_id')
    .eq('id', parsed.data.eventId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (!current) return { error: 'Event not found.' };

  const isOps = hasRole(ctx.role, 'ops');
  const isAssignedDriver = current.driver_id === ctx.user.id;
  if (!isOps && !isAssignedDriver) {
    return { error: 'You can only update deliveries assigned to you.' };
  }

  const { error } = await supabase
    .from('events')
    .update({ dispatch_status: parsed.data.status })
    .eq('id', parsed.data.eventId)
    .eq('org_id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app/dispatch');
  revalidatePath(`/app/events/${parsed.data.eventId}`);
  return { ok: true };
}
