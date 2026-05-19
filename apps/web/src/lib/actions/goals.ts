'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';

const periods = ['weekly', 'monthly', 'quarterly'] as const;

const schema = z.object({
  owner_id: z.string().uuid().optional().or(z.literal('')),
  location_id: z.string().uuid().optional().or(z.literal('')),
  period_type: z.enum(periods),
  period_start: z.string().min(10),
  revenue_goal: z.coerce.number().min(0).default(0),
  outbound_contacts: z.coerce.number().int().min(0).default(0),
  tastings: z.coerce.number().int().min(0).default(0),
  prospects_contacted: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export async function upsertGoal(formData: FormData) {
  const ctx = await requirePermission('org.manage');
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase.from('goals').upsert(
    {
      org_id: ctx.org.id,
      owner_id: parsed.data.owner_id || null,
      location_id: parsed.data.location_id || null,
      period_type: parsed.data.period_type,
      period_start: parsed.data.period_start,
      revenue_goal_cents: Math.round(parsed.data.revenue_goal * 100),
      activity_goals: {
        outbound_contacts: parsed.data.outbound_contacts,
        tastings: parsed.data.tastings,
        prospects_contacted: parsed.data.prospects_contacted,
      },
      notes: parsed.data.notes || null,
      created_by: ctx.user.id,
    },
    {
      onConflict: 'org_id, owner_id, location_id, period_type, period_start',
    },
  );
  if (error) return { error: error.message };
  revalidatePath('/app/goals');
  return { ok: true };
}

export async function deleteGoal(id: string) {
  await requirePermission('org.manage');
  const supabase = await createClient();
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/goals');
  return { ok: true };
}
