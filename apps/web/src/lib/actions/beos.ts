'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const contentSchema = z.object({
  kitchen_notes: z.string().max(4000).optional().default(''),
  service_notes: z.string().max(4000).optional().default(''),
  setup_instructions: z.string().max(4000).optional().default(''),
  equipment: z.string().max(4000).optional().default(''),
  dietary_allergens: z.string().max(4000).optional().default(''),
  staffing_notes: z.string().max(4000).optional().default(''),
  timeline: z.string().max(4000).optional().default(''),
  special_requests: z.string().max(4000).optional().default(''),
});

export async function createBeo(eventId: string) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('id, name, org_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) return { error: 'Event not found.' };

  const { data: latest } = await supabase
    .from('beos')
    .select('version')
    .eq('event_id', eventId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = (latest?.version ?? 0) + 1;

  const { data: beo, error } = await supabase
    .from('beos')
    .insert({
      event_id: eventId,
      org_id: event.org_id,
      version: nextVersion,
      title: `${event.name} — BEO v${nextVersion}`,
      status: 'draft',
      content: {},
      generated_by: ctx.user.id,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${eventId}`);
  return { ok: true, beoId: beo.id };
}

export async function updateBeo(beoId: string, formData: FormData) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const supabase = await createClient();

  const { data: beo } = await supabase
    .from('beos')
    .select('id, event_id, status')
    .eq('id', beoId)
    .maybeSingle();
  if (!beo) return { error: 'BEO not found.' };
  if (beo.status === 'final') return { error: 'This BEO is finalized. Create a new revision.' };

  const title = formData.get('title') as string;
  const notes = formData.get('notes') as string;
  const contentRaw: Record<string, string> = {};
  for (const key of contentSchema.shape ? Object.keys(contentSchema.shape) : []) {
    contentRaw[key] = (formData.get(key) as string) ?? '';
  }
  const content = contentSchema.parse(contentRaw);

  const { error } = await supabase
    .from('beos')
    .update({
      title: title?.trim() || null,
      notes: notes?.trim() || null,
      content,
    })
    .eq('id', beoId);
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${beo.event_id}`);
  return { ok: true };
}

export async function finalizeBeo(beoId: string) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const supabase = await createClient();
  const { data: beo } = await supabase
    .from('beos')
    .select('id, event_id')
    .eq('id', beoId)
    .maybeSingle();
  if (!beo) return { error: 'BEO not found.' };

  const { error } = await supabase
    .from('beos')
    .update({
      status: 'final',
      finalized_at: new Date().toISOString(),
      finalized_by: ctx.user.id,
    })
    .eq('id', beoId);
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${beo.event_id}`);
  return { ok: true };
}

export async function deleteBeo(beoId: string) {
  const ctx = await requireCurrent();
  if (!ctx.can('events.manage')) return { error: 'Permission denied.' };

  const supabase = await createClient();
  const { data: beo } = await supabase
    .from('beos')
    .select('id, event_id')
    .eq('id', beoId)
    .maybeSingle();
  if (!beo) return { error: 'BEO not found.' };

  const { error } = await supabase.from('beos').delete().eq('id', beoId);
  if (error) return { error: error.message };

  revalidatePath(`/app/events/${beo.event_id}`);
  return { ok: true };
}
