'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, tryCreateAdminClient } from '@/lib/supabase/admin';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg, sendEmail } from '@/lib/gmail/client';

// ─── Segments ───────────────────────────────────────────────────────────────
const segmentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  kind: z.enum(['dynamic', 'manual']).default('dynamic'),
  filters: z.record(z.unknown()).optional(),
});

export async function createSegment(formData: FormData) {
  const ctx = await requireCurrent();
  const raw = Object.fromEntries(formData);
  const filtersJson = typeof raw.filters === 'string' ? raw.filters : '{}';
  let filters: Record<string, unknown> = {};
  try {
    filters = JSON.parse(filtersJson || '{}');
  } catch {
    return { error: 'Invalid filter JSON' };
  }

  const parsed = segmentSchema.safeParse({
    name: raw.name,
    description: raw.description,
    kind: raw.kind,
    filters,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('segments')
    .insert({
      org_id: ctx.org.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      kind: parsed.data.kind,
      filters: parsed.data.filters ?? {},
      created_by: ctx.user.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/marketing/segments');
  redirect(`/app/marketing/segments/${data.id}`);
}

export async function deleteSegment(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('segments').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/marketing/segments');
  return { ok: true };
}

// ─── Campaigns ──────────────────────────────────────────────────────────────
const campaignSchema = z.object({
  name: z.string().trim().min(1).max(160),
  subject: z.string().trim().min(1).max(300),
  body_html: z.string().trim().min(1).max(50000),
  segment_id: z.string().uuid().optional().or(z.literal('')),
});

export async function createCampaign(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      org_id: ctx.org.id,
      name: parsed.data.name,
      subject: parsed.data.subject,
      body_html: parsed.data.body_html,
      body_text: stripHtml(parsed.data.body_html),
      segment_id: parsed.data.segment_id || null,
      created_by: ctx.user.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/marketing/campaigns');
  redirect(`/app/marketing/campaigns/${data.id}`);
}

export async function deleteCampaign(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/marketing/campaigns');
  return { ok: true };
}

/**
 * Send a campaign immediately. Resolves the target segment to a contact list,
 * fans out individual emails via the org's connected Gmail (one per contact,
 * not BCC — each contact gets a personalized email), and records sends.
 */
export async function sendCampaignNow(campaignId: string) {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const admin = tryCreateAdminClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return { error: 'Campaign not found' };
  if (campaign.status === 'sent') return { error: 'Already sent' };

  const connection = await getConnectionForOrg(ctx.org.id);
  if (!connection) {
    return { error: 'Connect Gmail in Settings → Integrations first.' };
  }

  // Resolve segment to contact ids
  let contactIds: string[] = [];
  if (campaign.segment_id) {
    const { data } = await supabase.rpc('segment_contacts', {
      p_segment_id: campaign.segment_id,
    });
    contactIds = ((data ?? []) as string[]) ?? [];
  } else {
    // No segment → send to all contacts with an email who aren't DNE
    const { data } = await supabase
      .from('contacts')
      .select('id')
      .eq('do_not_email', false)
      .not('email', 'is', null);
    contactIds = (data ?? []).map((r) => r.id);
  }

  if (contactIds.length === 0) return { error: 'Segment is empty' };

  // Fetch contact details
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, first_name, last_name, do_not_email')
    .in('id', contactIds);

  const recipients = (contacts ?? []).filter((c) => c.email && !c.do_not_email);
  if (recipients.length === 0) return { error: 'No sendable recipients' };

  await supabase
    .from('campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId);

  let sentCount = 0;
  for (const c of recipients) {
    const firstName = c.first_name ?? 'there';
    const personalizedHtml = campaign.body_html.replaceAll('{{first_name}}', firstName);
    const personalizedText = (campaign.body_text ?? stripHtml(campaign.body_html)).replaceAll(
      '{{first_name}}',
      firstName,
    );

    try {
      const sent = await sendEmail(connection, {
        to: c.email!,
        subject: campaign.subject,
        textBody: personalizedText,
        htmlBody: personalizedHtml,
      });
      if (admin) {
        await admin.from('campaign_sends').upsert(
          {
            campaign_id: campaignId,
            org_id: ctx.org.id,
            contact_id: c.id,
            status: 'sent',
            sent_at: new Date().toISOString(),
            gmail_message_id: sent.id,
          },
          { onConflict: 'campaign_id,contact_id' },
        );
      }
      sentCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      if (admin) {
        await admin.from('campaign_sends').upsert(
          {
            campaign_id: campaignId,
            org_id: ctx.org.id,
            contact_id: c.id,
            status: 'failed',
            error: msg,
          },
          { onConflict: 'campaign_id,contact_id' },
        );
      }
    }
  }

  await supabase
    .from('campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_count: sentCount,
    })
    .eq('id', campaignId);

  revalidatePath(`/app/marketing/campaigns/${campaignId}`);
  revalidatePath('/app/marketing/campaigns');
  return { ok: true, sent: sentCount, skipped: recipients.length - sentCount };
}

// ─── Sequences ──────────────────────────────────────────────────────────────
const sequenceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  trigger: z.enum([
    'inbound_lead',
    'quote_sent',
    'quote_accepted',
    'event_completed',
    'annual_rebook',
    'abandoned_quote',
    'manual',
  ]),
});

export async function createSequence(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = sequenceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('sequences')
    .insert({
      org_id: ctx.org.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      trigger: parsed.data.trigger,
      created_by: ctx.user.id,
    })
    .select('id')
    .single();

  if (error) return { error: error.message };
  revalidatePath('/app/marketing/sequences');
  redirect(`/app/marketing/sequences/${data.id}`);
}

export async function deleteSequence(id: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('sequences').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/marketing/sequences');
  return { ok: true };
}

const stepSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body_html: z.string().trim().min(1).max(50000),
  delay_hours: z.coerce.number().int().min(0).max(24 * 365),
});

export async function addSequenceStep(sequenceId: string, formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = stepSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  // figure out next position
  const { data: last } = await supabase
    .from('sequence_steps')
    .select('position')
    .eq('sequence_id', sequenceId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  const { error } = await supabase.from('sequence_steps').insert({
    sequence_id: sequenceId,
    position,
    delay_hours: parsed.data.delay_hours,
    subject: parsed.data.subject,
    body_html: parsed.data.body_html,
    body_text: stripHtml(parsed.data.body_html),
  });
  if (error) return { error: error.message };

  // Note: ctx.org.id available if we need it for auditing later
  void ctx;

  revalidatePath(`/app/marketing/sequences/${sequenceId}`);
  return { ok: true };
}

export async function deleteSequenceStep(id: string, sequenceId: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('sequence_steps').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/app/marketing/sequences/${sequenceId}`);
  return { ok: true };
}

export async function setSequenceStatus(
  id: string,
  status: 'draft' | 'active' | 'paused',
) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('sequences').update({ status }).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/marketing/sequences');
  revalidatePath(`/app/marketing/sequences/${id}`);
  return { ok: true };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cron handler: fire next-due sequence steps
export async function processSequenceEnrollments() {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Find active enrollments whose next_send_at is due
  const { data: due } = await admin
    .from('sequence_enrollments')
    .select('id, org_id, sequence_id, contact_id, current_step')
    .eq('status', 'active')
    .lte('next_send_at', now)
    .limit(200);

  if (!due || due.length === 0) return { processed: 0 };

  let processed = 0;
  for (const enr of due) {
    // Find current step
    const { data: step } = await admin
      .from('sequence_steps')
      .select('id, subject, body_html, body_text, delay_hours')
      .eq('sequence_id', enr.sequence_id)
      .eq('position', enr.current_step)
      .maybeSingle();

    if (!step) {
      await admin
        .from('sequence_enrollments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', enr.id);
      continue;
    }

    const connection = await getConnectionForOrg(enr.org_id);
    const { data: contact } = await admin
      .from('contacts')
      .select('email, first_name, do_not_email')
      .eq('id', enr.contact_id)
      .maybeSingle();

    if (!connection || !contact?.email || contact.do_not_email) {
      await admin
        .from('sequence_enrollments')
        .update({ status: 'failed' })
        .eq('id', enr.id);
      continue;
    }

    const firstName = contact.first_name ?? 'there';
    const html = step.body_html.replaceAll('{{first_name}}', firstName);
    const text = (step.body_text ?? stripHtml(step.body_html)).replaceAll(
      '{{first_name}}',
      firstName,
    );

    try {
      await sendEmail(connection, {
        to: contact.email,
        subject: step.subject,
        textBody: text,
        htmlBody: html,
      });
      // Advance to next step
      const nextStepPos = enr.current_step + 1;
      const { data: nextStep } = await admin
        .from('sequence_steps')
        .select('delay_hours')
        .eq('sequence_id', enr.sequence_id)
        .eq('position', nextStepPos)
        .maybeSingle();

      if (nextStep) {
        const nextAt = new Date(
          Date.now() + nextStep.delay_hours * 3600 * 1000,
        ).toISOString();
        await admin
          .from('sequence_enrollments')
          .update({ current_step: nextStepPos, next_send_at: nextAt })
          .eq('id', enr.id);
      } else {
        await admin
          .from('sequence_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enr.id);
      }
      processed++;
    } catch (err) {
      console.error('[sequence] send failed', err);
      await admin.from('sequence_enrollments').update({ status: 'failed' }).eq('id', enr.id);
    }
  }

  return { processed };
}

export async function enrollContactInSequence(sequenceId: string, contactId: string) {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  // Get the first step's delay to set next_send_at
  const { data: firstStep } = await supabase
    .from('sequence_steps')
    .select('delay_hours')
    .eq('sequence_id', sequenceId)
    .eq('position', 0)
    .maybeSingle();
  if (!firstStep) return { error: 'Sequence has no steps yet.' };

  const nextAt = new Date(Date.now() + firstStep.delay_hours * 3600 * 1000).toISOString();

  const { error } = await supabase.from('sequence_enrollments').insert({
    org_id: ctx.org.id,
    sequence_id: sequenceId,
    contact_id: contactId,
    current_step: 0,
    next_send_at: nextAt,
    status: 'active',
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/marketing/sequences/${sequenceId}`);
  return { ok: true };
}
