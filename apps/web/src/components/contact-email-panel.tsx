import Link from 'next/link';
import { Mail } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg, searchMessagesForContact } from '@/lib/gmail/client';
import { SendEmailForm } from './send-email-form';

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

  // Fetch messages — best-effort; failures shouldn't break the page.
  let messages: Awaited<ReturnType<typeof searchMessagesForContact>> = [];
  let fetchError: string | null = null;
  try {
    messages = await searchMessagesForContact(connection, contactEmail, 10);
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Failed to load emails';
  }

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Email</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          via {connection.email}
        </span>
      </div>

      <SendEmailForm
        contactId={contactId}
        to={contactEmail}
        defaultSubject=""
      />

      {fetchError ? (
        <p className="mt-4 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          Couldn&apos;t load recent emails: {fetchError}
        </p>
      ) : messages.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          No prior emails with this contact yet.
        </p>
      ) : (
        <ul className="mt-6 space-y-3 border-t pt-4">
          {messages.map((m) => (
            <li
              key={m.id}
              className="rounded-md border p-3 text-sm transition-colors hover:bg-accent/30"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{m.subject || '(no subject)'}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                  {m.isInbound ? 'Inbound' : 'Sent'}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {new Date(m.date).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
