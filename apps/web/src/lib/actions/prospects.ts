'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const segments = [
  'corporate_office',
  'wedding_venue',
  'event_planner',
  'hospital',
  'school',
  'nonprofit',
  'other',
] as const;

const statuses = ['cold', 'warming', 'converted_to_lead', 'dead'] as const;

const schema = z.object({
  company_name: z.string().trim().min(1).max(200),
  contact_name: z.string().trim().max(200).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  segment: z.enum(segments),
  status: z.enum(statuses).default('cold'),
  location_id: z.string().uuid().optional().or(z.literal('')),
  next_touch_at: z.string().optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export async function createProspect(formData: FormData) {
  const ctx = await requireCurrent();
  const raw = Object.fromEntries(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { email, phone, location_id, next_touch_at, ...rest } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      org_id: ctx.org.id,
      owner_id: ctx.user.id,
      company_name: rest.company_name,
      contact_name: rest.contact_name || null,
      segment: rest.segment,
      status: rest.status,
      location_id: location_id || null,
      next_touch_at: next_touch_at || null,
      notes: rest.notes || null,
      contact_info: email || phone ? { email: email || null, phone: phone || null } : {},
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app/prospects');
  redirect(`/app/prospects/${data.id}`);
}

export async function updateProspect(id: string, formData: FormData) {
  await requireCurrent();
  const raw = Object.fromEntries(formData);
  const parsed = schema.partial().safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { email, phone, location_id, next_touch_at, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { ...rest };
  if (location_id !== undefined) patch.location_id = location_id || null;
  if (next_touch_at !== undefined) patch.next_touch_at = next_touch_at || null;
  if (email !== undefined || phone !== undefined) {
    patch.contact_info = { email: email || null, phone: phone || null };
  }
  if (rest.contact_name !== undefined && rest.contact_name === '') patch.contact_name = null;
  if (rest.notes !== undefined && rest.notes === '') patch.notes = null;

  const supabase = await createClient();
  const { error } = await supabase.from('prospects').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/prospects');
  revalidatePath(`/app/prospects/${id}`);
  return { ok: true };
}

export async function convertProspectToLead(id: string) {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const { data: p, error: pErr } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (pErr || !p) return { error: pErr?.message ?? 'Prospect not found' };

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id')
    .eq('is_default', true)
    .maybeSingle();
  if (!pipeline) return { error: 'No default pipeline' };

  const { data: stage } = await supabase
    .from('stages')
    .select('id')
    .eq('pipeline_id', pipeline.id)
    .eq('name', 'Lead')
    .maybeSingle();
  if (!stage) return { error: 'No Lead stage' };

  const info = (p.contact_info ?? {}) as { email?: string | null; phone?: string | null };
  const nameParts = (p.contact_name ?? '').trim().split(/\s+/);
  const firstName = nameParts[0] || null;
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

  const { data: company } = await supabase
    .from('companies')
    .insert({ org_id: ctx.org.id, name: p.company_name })
    .select('id')
    .single();

  const { data: contact } = await supabase
    .from('contacts')
    .insert({
      org_id: ctx.org.id,
      company_id: company?.id ?? null,
      first_name: firstName,
      last_name: lastName,
      email: info.email ?? null,
      phone: info.phone ?? null,
      lifecycle_stage: 'lead',
      lead_source: 'outbound',
    })
    .select('id')
    .single();

  const { data: deal, error: dErr } = await supabase
    .from('deals')
    .insert({
      org_id: ctx.org.id,
      pipeline_id: pipeline.id,
      stage_id: stage.id,
      owner_id: ctx.user.id,
      contact_id: contact?.id ?? null,
      company_id: company?.id ?? null,
      title: p.company_name,
      source: 'outbound',
      source_detail: p.notes ?? null,
      location_id: p.location_id,
    })
    .select('id')
    .single();
  if (dErr) return { error: dErr.message };

  await supabase
    .from('prospects')
    .update({ status: 'converted_to_lead', converted_deal_id: deal.id })
    .eq('id', id);

  revalidatePath('/app/prospects');
  revalidatePath('/app/pipeline');
  redirect(`/app/deals/${deal.id}`);
}
