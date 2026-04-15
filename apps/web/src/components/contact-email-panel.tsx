import Link from 'next/link';
import { Mail } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg } from '@/lib/gmail/client';
import { createClient } from '@/lib/supabase/server';
import { EmailThreadPanel, type StoredMessage } from '@/components/email/email-thread-panel';

export async function ContactEmailPanel({
  contactId,
  contactEmail,
}: {
  contactId: string;
  contactEmail: string | null;
}) {
  const ctx = await requireCurrent();

  if (!contactEmail) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-2 font-semibold">Email</h2>
        <p className="text-sm text-muted-foreground">
          No email address on file for this contact.
        </p>
      </section>
    );
  }

  const connection = await getConnectionForOrg(ctx.org.id);

  if (!connection) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <div className="mb-2 flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Email</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect Gmail in{' '}
          <Link
            href="/app/settings/integrations"
            className="font-medium text-primary hover:underline"
          >
            Settings → Integrations
          </Link>{' '}
          to send and view emails here.
        </p>
      </section>
    );
  }

  const supabase = await createClient();
  const { data: messages } = await supabase
    .from('email_messages')
    .select(
      'id, gmail_message_id, gmail_thread_id, from_address, to_addresses, subject, snippet, body_text, body_html, direction, sent_at',
    )
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: false })
    .limit(100);

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Email</h2>
      </div>
      <EmailThreadPanel
        contactId={contactId}
        contactEmail={contactEmail}
        connectedInbox={connection.email}
        messages={(messages ?? []) as StoredMessage[]}
      />
    </section>
  );
}
