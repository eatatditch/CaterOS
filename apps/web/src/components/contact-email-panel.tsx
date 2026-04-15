import Link from 'next/link';
import { AlertTriangle, Mail } from 'lucide-react';
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

  // Render the whole panel inside a try/catch so an unexpected failure
  // (missing env var, RLS glitch, Gmail outage) degrades gracefully
  // instead of 500'ing the whole page.
  try {
    const ctx = await requireCurrent();
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
  } catch (err) {
    console.error('[ContactEmailPanel] failed to render', err);
    return (
      <section className="rounded-lg border border-yellow-400/40 bg-yellow-50 p-6 text-sm dark:bg-yellow-500/10">
        <div className="mb-1 flex items-center gap-2 font-semibold text-yellow-900 dark:text-yellow-300">
          <AlertTriangle className="h-4 w-4" />
          Email panel unavailable
        </div>
        <p className="text-yellow-900/80 dark:text-yellow-200">
          We couldn&apos;t load Gmail right now. This is usually fixed by confirming{' '}
          <code className="rounded bg-yellow-100 px-1 text-xs dark:bg-yellow-500/20">
            SUPABASE_SERVICE_ROLE_KEY
          </code>{' '}
          is set in Vercel, then redeploying.
        </p>
      </section>
    );
  }
}
