import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { refreshAccessToken } from './oauth';

type Connection = {
  id: string;
  org_id: string;
  email: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
};

export async function getConnectionForOrg(orgId: string): Promise<Connection | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('gmail_connections')
    .select('id, org_id, email, access_token, refresh_token, token_expires_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  const twoMinFromNow = Date.now() + 2 * 60 * 1000;

  if (expiresAt > twoMinFromNow || !data.refresh_token) {
    return data as Connection;
  }

  try {
    const refreshed = await refreshAccessToken(data.refresh_token);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin
      .from('gmail_connections')
      .update({ access_token: refreshed.access_token, token_expires_at: newExpiry })
      .eq('id', data.id);
    return { ...data, access_token: refreshed.access_token, token_expires_at: newExpiry };
  } catch (err) {
    console.error('[gmail] refresh failed', err);
    return data as Connection;
  }
}

function base64url(input: string | Buffer): string {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function boundary() {
  return '=_Part_' + Math.random().toString(36).slice(2, 14);
}

export type SendAttachment = {
  filename: string;
  contentType: string;
  data: Buffer;
};

/**
 * Send a multipart email via Gmail API. If `html` is provided, sends
 * multipart/alternative with plain-text fallback. If attachments present,
 * wraps in multipart/mixed.
 */
export async function sendEmail(
  connection: Connection,
  args: {
    to: string;
    subject: string;
    textBody: string;
    htmlBody?: string;
    cc?: string;
    bcc?: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
    attachments?: SendAttachment[];
  },
): Promise<{ id: string; threadId: string }> {
  const hasHtml = !!args.htmlBody;
  const hasAttachments = !!args.attachments && args.attachments.length > 0;

  const altBoundary = boundary();
  const mixedBoundary = boundary();

  let body = '';
  const headers: string[] = [
    `From: ${connection.email}`,
    `To: ${args.to}`,
    args.cc ? `Cc: ${args.cc}` : null,
    args.bcc ? `Bcc: ${args.bcc}` : null,
    `Subject: ${args.subject}`,
    args.inReplyTo ? `In-Reply-To: ${args.inReplyTo}` : null,
    args.references ? `References: ${args.references}` : null,
    'MIME-Version: 1.0',
  ].filter(Boolean) as string[];

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    body += `\r\n--${mixedBoundary}\r\n`;

    if (hasHtml) {
      body += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
      body += `--${altBoundary}\r\n`;
      body += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
      body += args.textBody;
      body += `\r\n--${altBoundary}\r\n`;
      body += 'Content-Type: text/html; charset="UTF-8"\r\n\r\n';
      body += args.htmlBody;
      body += `\r\n--${altBoundary}--\r\n`;
    } else {
      body += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
      body += args.textBody;
    }

    for (const att of args.attachments ?? []) {
      body += `\r\n--${mixedBoundary}\r\n`;
      body += `Content-Type: ${att.contentType}; name="${att.filename}"\r\n`;
      body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += att.data.toString('base64').replace(/(.{76})/g, '$1\r\n');
    }
    body += `\r\n--${mixedBoundary}--\r\n`;
  } else if (hasHtml) {
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
    body += `\r\n--${altBoundary}\r\n`;
    body += 'Content-Type: text/plain; charset="UTF-8"\r\n\r\n';
    body += args.textBody;
    body += `\r\n--${altBoundary}\r\n`;
    body += 'Content-Type: text/html; charset="UTF-8"\r\n\r\n';
    body += args.htmlBody;
    body += `\r\n--${altBoundary}--\r\n`;
  } else {
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    body += `\r\n${args.textBody}`;
  }

  const raw = `${headers.join('\r\n')}${body}`;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64url(raw), threadId: args.threadId ?? undefined }),
  });
  if (!res.ok) {
    throw new Error(`gmail send failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { id: string; threadId: string };
}

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  isInbound: boolean;
};

export async function searchMessagesForContact(
  connection: Connection,
  contactEmail: string,
  maxResults = 20,
): Promise<GmailMessage[]> {
  const query = encodeURIComponent(
    `(from:${contactEmail} OR to:${contactEmail} OR cc:${contactEmail})`,
  );
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } },
  );
  if (!listRes.ok) {
    throw new Error(`gmail list failed: ${listRes.status} ${await listRes.text()}`);
  }
  const list = (await listRes.json()) as { messages?: { id: string; threadId: string }[] };
  const messages = list.messages ?? [];
  if (messages.length === 0) return [];

  const details = await Promise.all(
    messages.map(async (m) => {
      const detailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${connection.access_token}` } },
      );
      if (!detailRes.ok) return null;
      return (await detailRes.json()) as {
        id: string;
        threadId: string;
        snippet: string;
        internalDate: string;
        payload: { headers: { name: string; value: string }[] };
      };
    }),
  );

  return details
    .filter((d): d is NonNullable<typeof d> => d != null)
    .map((d) => {
      const h = (name: string) =>
        d.payload.headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? '';
      const from = h('From');
      const to = h('To');
      const subject = h('Subject');
      const date = h('Date') || new Date(parseInt(d.internalDate, 10)).toISOString();
      const isInbound = from.toLowerCase().includes(contactEmail.toLowerCase());
      return { id: d.id, threadId: d.threadId, snippet: d.snippet, subject, from, to, date, isInbound };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Full message fetch — body + headers — for rendering a thread.
 */
export type FullMessage = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyHtml: string | null;
  bodyText: string | null;
  isInbound: boolean;
};

export async function getMessage(
  connection: Connection,
  messageId: string,
  contactEmail?: string,
): Promise<FullMessage | null> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } },
  );
  if (!res.ok) return null;
  const m = (await res.json()) as {
    id: string;
    threadId: string;
    internalDate: string;
    payload: {
      headers: { name: string; value: string }[];
      mimeType?: string;
      body?: { data?: string; size?: number };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      }>;
    };
  };

  const h = (name: string) =>
    m.payload.headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? '';

  const from = h('From');
  const to = h('To');
  const subject = h('Subject');
  const date = h('Date') || new Date(parseInt(m.internalDate, 10)).toISOString();

  const bodyByType = extractBody(m.payload);

  return {
    id: m.id,
    threadId: m.threadId,
    from,
    to,
    subject,
    date,
    bodyHtml: bodyByType.html,
    bodyText: bodyByType.text,
    isInbound: contactEmail ? from.toLowerCase().includes(contactEmail.toLowerCase()) : false,
  };
}

function decodeBase64url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function extractBody(payload: {
  mimeType?: string;
  body?: { data?: string };
  parts?: Array<{
    mimeType: string;
    body?: { data?: string };
    parts?: Array<{ mimeType: string; body?: { data?: string } }>;
  }>;
}): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;

  function walk(part: {
    mimeType?: string;
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    }>;
  }) {
    const mime = part.mimeType?.toLowerCase() ?? '';
    if (mime === 'text/html' && part.body?.data && !html) {
      html = decodeBase64url(part.body.data);
    } else if (mime === 'text/plain' && part.body?.data && !text) {
      text = decodeBase64url(part.body.data);
    }
    for (const sub of part.parts ?? []) walk(sub);
  }
  walk(payload);
  return { html, text };
}

/**
 * Fetch a full thread (ordered messages).
 */
export async function getThread(
  connection: Connection,
  threadId: string,
  contactEmail?: string,
): Promise<FullMessage[]> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${connection.access_token}` } },
  );
  if (!res.ok) return [];
  type ThreadMsg = {
    id: string;
    threadId: string;
    internalDate: string;
    payload: {
      headers: { name: string; value: string }[];
      mimeType?: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
        parts?: Array<{ mimeType: string; body?: { data?: string } }>;
      }>;
    };
  };
  const t = (await res.json()) as { messages?: ThreadMsg[] };

  return (t.messages ?? []).map((m) => {
    const h = (name: string) =>
      m.payload.headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? '';
    const from = h('From');
    const body = extractBody(m.payload);
    return {
      id: m.id,
      threadId: m.threadId,
      from,
      to: h('To'),
      subject: h('Subject'),
      date: h('Date') || new Date(parseInt(m.internalDate, 10)).toISOString(),
      bodyHtml: body.html,
      bodyText: body.text,
      isInbound: contactEmail ? from.toLowerCase().includes(contactEmail.toLowerCase()) : false,
    };
  });
}
