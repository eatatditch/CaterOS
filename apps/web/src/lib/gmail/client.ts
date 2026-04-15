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

/**
 * Fetch the org's Gmail connection and refresh the access token if it's
 * within 2 minutes of expiry.
 */
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

  // Refresh
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

/** Base64url-encode a UTF-8 string (Gmail API raw message format). */
function base64url(s: string): string {
  return Buffer.from(s, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(
  connection: Connection,
  args: { to: string; subject: string; body: string; cc?: string; bcc?: string },
): Promise<{ id: string; threadId: string }> {
  const headers = [
    `From: ${connection.email}`,
    `To: ${args.to}`,
    args.cc ? `Cc: ${args.cc}` : null,
    args.bcc ? `Bcc: ${args.bcc}` : null,
    `Subject: ${args.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
  ]
    .filter(Boolean)
    .join('\r\n');
  const raw = `${headers}\r\n\r\n${args.body}`;

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64url(raw) }),
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

/**
 * Search Gmail for messages involving a specific contact email (any direction).
 */
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

  // Batch-ish: fire metadata fetches in parallel
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
      return {
        id: d.id,
        threadId: d.threadId,
        snippet: d.snippet,
        subject,
        from,
        to,
        date,
        isInbound,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
