'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createAdminClient, tryCreateAdminClient } from '@/lib/supabase/admin';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg, sendEmail, type SendAttachment } from '@/lib/gmail/client';

const attachmentRefSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  content_type: z.string().nullable(),
  storage_path: z.string(),
});

export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

const sendSchema = z.object({
  contact_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().trim().min(1).max(300),
  text_body: z.string().trim().min(1).max(20000),
  html_body: z.string().optional().nullable(),
  thread_id: z.string().optional().nullable(),
  in_reply_to: z.string().optional().nullable(),
  references: z.string().optional().nullable(),
  attachments: z.array(attachmentRefSchema).max(10).default([]),
});

export async function sendContactEmail(input: z.input<typeof sendSchema>) {
  const ctx = await requireCurrent();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const connection = await getConnectionForOrg(ctx.org.id);
  if (!connection) {
    return { error: 'No Gmail account connected. Connect one in Settings → Integrations.' };
  }

  const admin = createAdminClient();

  // Download attachment blobs from Storage
  const attachments: SendAttachment[] = [];
  for (const a of parsed.data.attachments) {
    const dl = await admin.storage.from('email-attachments').download(a.storage_path);
    if (dl.error || !dl.data) {
      return { error: `Failed to load attachment ${a.filename}` };
    }
    const buf = Buffer.from(await dl.data.arrayBuffer());
    attachments.push({
      filename: a.filename,
      contentType: a.content_type ?? 'application/octet-stream',
      data: buf,
    });
  }

  // Derive plain-text fallback from HTML if only HTML provided
  const text = parsed.data.text_body;
  const html = parsed.data.html_body ?? null;

  try {
    const sent = await sendEmail(connection, {
      to: parsed.data.to,
      subject: parsed.data.subject,
      textBody: text,
      htmlBody: html ?? undefined,
      threadId: parsed.data.thread_id ?? undefined,
      inReplyTo: parsed.data.in_reply_to ?? undefined,
      references: parsed.data.references ?? undefined,
      attachments,
    });

    // Log as activity
    await admin.from('activities').insert({
      org_id: ctx.org.id,
      type: 'email',
      contact_id: parsed.data.contact_id,
      owner_id: ctx.user.id,
      subject: parsed.data.subject,
      body: text,
      meta: {
        gmail_message_id: sent.id,
        gmail_thread_id: sent.threadId,
        to: parsed.data.to,
        from: connection.email,
        outbound: true,
        attachment_ids: parsed.data.attachments.map((a) => a.id),
      },
    });

    // Mirror into email_messages for the threaded view / polling
    await admin.from('email_messages').upsert(
      {
        org_id: ctx.org.id,
        gmail_message_id: sent.id,
        gmail_thread_id: sent.threadId,
        contact_id: parsed.data.contact_id,
        from_address: connection.email,
        to_addresses: [parsed.data.to],
        subject: parsed.data.subject,
        snippet: text.slice(0, 200),
        body_text: text,
        body_html: html,
        has_attachments: attachments.length > 0,
        direction: 'outbound',
        sent_at: new Date().toISOString(),
      },
      { onConflict: 'org_id,gmail_message_id' },
    );

    revalidatePath(`/app/contacts/${parsed.data.contact_id}`);
    return { ok: true, message_id: sent.id, thread_id: sent.threadId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send';
    return { error: msg };
  }
}

const uploadSchema = z.object({
  filename: z.string().min(1).max(240),
  content_type: z.string().max(120).optional().nullable(),
  size: z.number().int().min(0).max(26214400), // 25 MB
  data_base64: z.string(),
});

const registerSchema = z.object({
  storage_path: z.string().min(1).max(500),
  filename: z.string().min(1).max(240),
  content_type: z.string().max(120).optional().nullable(),
  size: z.number().int().min(0).max(26214400),
});

/**
 * Registers an attachment that was uploaded directly to Supabase Storage
 * by the browser. Returns the attachment ref we use when sending.
 * We verify the file exists at that path and belongs to this org before
 * writing the metadata row.
 */
export async function registerAttachment(input: z.infer<typeof registerSchema>) {
  const ctx = await requireCurrent();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  // Path must be scoped to this org (first folder segment)
  const firstSeg = parsed.data.storage_path.split('/')[0];
  if (firstSeg !== ctx.org.id) {
    return { error: 'Attachment path not scoped to your org.' };
  }

  const admin = tryCreateAdminClient();
  if (!admin) return { error: 'Missing SUPABASE_SERVICE_ROLE_KEY — contact your admin.' };

  // Confirm the file exists in storage
  const { error: headErr } = await admin.storage
    .from('email-attachments')
    .createSignedUrl(parsed.data.storage_path, 60);
  if (headErr) return { error: `Upload not found: ${headErr.message}` };

  const { data: row, error: rowErr } = await admin
    .from('email_attachments')
    .insert({
      org_id: ctx.org.id,
      storage_path: parsed.data.storage_path,
      filename: parsed.data.filename,
      content_type: parsed.data.content_type,
      size_bytes: parsed.data.size,
      uploaded_by: ctx.user.id,
    })
    .select('id, filename, content_type, storage_path')
    .single();
  if (rowErr) return { error: rowErr.message };

  return {
    ok: true,
    attachment: {
      id: row.id,
      filename: row.filename,
      content_type: row.content_type,
      storage_path: row.storage_path,
    },
  };
}

/** @deprecated use registerAttachment + direct-to-storage client upload */
export async function uploadAttachment(input: z.infer<typeof uploadSchema>) {
  const ctx = await requireCurrent();
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid upload' };

  const buf = Buffer.from(parsed.data.data_base64, 'base64');
  const admin = createAdminClient();
  const storagePath = `${ctx.org.id}/${Date.now()}-${parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  const { error: uploadErr } = await admin.storage
    .from('email-attachments')
    .upload(storagePath, buf, {
      contentType: parsed.data.content_type ?? 'application/octet-stream',
      upsert: false,
    });
  if (uploadErr) return { error: uploadErr.message };

  const { data: row, error: rowErr } = await admin
    .from('email_attachments')
    .insert({
      org_id: ctx.org.id,
      storage_path: storagePath,
      filename: parsed.data.filename,
      content_type: parsed.data.content_type,
      size_bytes: parsed.data.size,
      uploaded_by: ctx.user.id,
    })
    .select('id, filename, content_type, storage_path')
    .single();
  if (rowErr) return { error: rowErr.message };

  return {
    ok: true,
    attachment: {
      id: row.id,
      filename: row.filename,
      content_type: row.content_type,
      storage_path: row.storage_path,
    },
  };
}

export async function disconnectGmail() {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners/managers can disconnect Gmail.' };
  }
  const admin = createAdminClient();
  const { error } = await admin.from('gmail_connections').delete().eq('org_id', ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath('/app/settings/integrations');
  return { ok: true };
}

/**
 * Sync a contact's Gmail messages into email_messages table. Called periodically
 * from the client via a polling API endpoint.
 */
export async function syncContactEmails(contactId: string): Promise<{
  ok?: true;
  error?: string;
  new_count?: number;
}> {
  const ctx = await requireCurrent();
  const admin = tryCreateAdminClient();
  if (!admin) return { error: 'Gmail sync requires SUPABASE_SERVICE_ROLE_KEY to be set.' };

  const { data: contact } = await admin
    .from('contacts')
    .select('id, email')
    .eq('id', contactId)
    .eq('org_id', ctx.org.id)
    .maybeSingle();
  if (!contact || !contact.email) return { error: 'Contact has no email' };

  const connection = await getConnectionForOrg(ctx.org.id);
  if (!connection) return { error: 'no_connection' };

  const { searchMessagesForContact, getMessage } = await import('@/lib/gmail/client');
  const messages = await searchMessagesForContact(connection, contact.email, 25);

  // Figure out which ones we already have
  const { data: existing } = await admin
    .from('email_messages')
    .select('gmail_message_id')
    .eq('org_id', ctx.org.id)
    .in(
      'gmail_message_id',
      messages.map((m) => m.id),
    );
  const existingIds = new Set((existing ?? []).map((e) => e.gmail_message_id));
  const toFetch = messages.filter((m) => !existingIds.has(m.id));

  let newCount = 0;
  for (const m of toFetch) {
    const full = await getMessage(connection, m.id, contact.email);
    if (!full) continue;
    await admin.from('email_messages').upsert(
      {
        org_id: ctx.org.id,
        gmail_message_id: full.id,
        gmail_thread_id: full.threadId,
        contact_id: contactId,
        from_address: full.from,
        to_addresses: [full.to],
        subject: full.subject,
        snippet: m.snippet,
        body_text: full.bodyText,
        body_html: full.bodyHtml,
        direction: full.isInbound ? 'inbound' : 'outbound',
        sent_at: new Date(full.date).toISOString(),
      },
      { onConflict: 'org_id,gmail_message_id' },
    );
    newCount++;
  }

  if (newCount > 0) revalidatePath(`/app/contacts/${contactId}`);
  return { ok: true, new_count: newCount };
}
