'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, Reply, RefreshCw, MailPlus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { syncContactEmails } from '@/lib/actions/gmail';
import { EmailComposer } from './email-composer';

export type StoredMessage = {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  from_address: string;
  to_addresses: string[];
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  body_html: string | null;
  direction: 'inbound' | 'outbound';
  sent_at: string;
};

type ThreadGroup = {
  threadId: string;
  messages: StoredMessage[];
  subject: string;
  latestAt: string;
};

export function EmailThreadPanel({
  contactId,
  contactEmail,
  connectedInbox,
  messages,
}: {
  contactId: string;
  contactEmail: string;
  connectedInbox: string;
  messages: StoredMessage[];
}) {
  const router = useRouter();
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [composingNew, setComposingNew] = useState(messages.length === 0);
  const [isSyncing, startSync] = useTransition();

  const threads = useMemo<ThreadGroup[]>(() => {
    const byThread = new Map<string, StoredMessage[]>();
    for (const m of messages) {
      const list = byThread.get(m.gmail_thread_id) ?? [];
      list.push(m);
      byThread.set(m.gmail_thread_id, list);
    }
    const groups = Array.from(byThread.entries()).map(([threadId, msgs]) => {
      const sorted = msgs.sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime(),
      );
      return {
        threadId,
        messages: sorted,
        subject: sorted[0]?.subject ?? '(no subject)',
        latestAt: sorted[sorted.length - 1]?.sent_at ?? new Date(0).toISOString(),
      };
    });
    return groups.sort(
      (a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime(),
    );
  }, [messages]);

  const sync = useCallback(
    (silent = false) => {
      startSync(async () => {
        const res = await syncContactEmails(contactId);
        if (res.error) {
          if (!silent) toast.error(res.error);
          return;
        }
        if (res.new_count && res.new_count > 0) {
          if (!silent) toast.success(`${res.new_count} new email${res.new_count === 1 ? '' : 's'}`);
          router.refresh();
        }
      });
    },
    [contactId, router],
  );

  // Poll every 45 seconds for new messages while the page is in focus
  useEffect(() => {
    let iv: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (iv) return;
      iv = setInterval(() => sync(true), 45_000);
    };
    const stop = () => {
      if (iv) {
        clearInterval(iv);
        iv = null;
      }
    };
    if (document.visibilityState === 'visible') start();
    const onVis = () => (document.visibilityState === 'visible' ? start() : stop());
    document.addEventListener('visibilitychange', onVis);
    // initial sync to catch anything we don't have yet
    sync(true);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sync]);

  function toggleThread(id: string) {
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Sending via <span className="font-medium text-foreground">{connectedInbox}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => sync(false)}
            disabled={isSyncing}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            type="button"
            onClick={() => {
              setComposingNew((v) => !v);
              setReplyingTo(null);
            }}
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <MailPlus className="h-3 w-3" />
            {composingNew ? 'Close' : 'New email'}
          </button>
        </div>
      </div>

      {composingNew ? (
        <div className="rounded-md border bg-muted/10 p-4">
          <EmailComposer
            contactId={contactId}
            to={contactEmail}
            onSent={() => {
              setComposingNew(false);
              sync(true);
            }}
          />
        </div>
      ) : null}

      {threads.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
          No emails with this contact yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => {
            const isOpen = openThreads.has(t.threadId);
            const latest = t.messages[t.messages.length - 1];
            const lastInbound = [...t.messages].reverse().find((m) => m.direction === 'inbound');
            return (
              <li key={t.threadId} className="rounded-md border bg-card">
                <button
                  type="button"
                  onClick={() => toggleThread(t.threadId)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent/30"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {t.subject || '(no subject)'}
                      </span>
                      <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {t.messages.length}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {latest?.snippet ?? ''}
                    </div>
                  </div>
                  <div className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(t.latestAt), { addSuffix: true })}
                  </div>
                </button>

                {isOpen ? (
                  <div className="border-t">
                    {t.messages.map((m) => (
                      <MessageBlock key={m.id} message={m} />
                    ))}

                    {replyingTo === t.threadId ? (
                      <div className="border-t bg-muted/10 p-4">
                        <EmailComposer
                          contactId={contactId}
                          to={contactEmail}
                          replyTo={{
                            threadId: t.threadId,
                            inReplyTo: lastInbound?.gmail_message_id ?? null,
                            references: lastInbound?.gmail_message_id ?? null,
                            suggestedSubject: t.subject.toLowerCase().startsWith('re:')
                              ? t.subject
                              : `Re: ${t.subject}`,
                          }}
                          onSent={() => {
                            setReplyingTo(null);
                            sync(true);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="border-t px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setReplyingTo(t.threadId)}
                          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent"
                        >
                          <Reply className="h-3 w-3" />
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MessageBlock({ message }: { message: StoredMessage }) {
  return (
    <div className="border-t px-4 py-3 first:border-t-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 text-xs">
          <span className="font-medium">{message.from_address}</span>
          <span className="ml-1 text-muted-foreground">
            → {(message.to_addresses ?? []).join(', ')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 font-medium uppercase tracking-wider',
              message.direction === 'inbound'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-green-100 text-green-800',
            )}
          >
            {message.direction}
          </span>
          <span>
            {new Date(message.sent_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
      {message.body_html ? (
        <div
          className="prose prose-sm max-w-none text-sm [&_a]:text-primary"
          dangerouslySetInnerHTML={{ __html: sanitize(message.body_html) }}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-foreground/80">
          {message.body_text ?? message.snippet ?? ''}
        </p>
      )}
    </div>
  );
}

// Bare-minimum HTML sanitizer — strips <script>, <iframe>, event handlers,
// and javascript:/data: URIs. Good enough for display of our own received emails.
function sanitize(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*"(?:[^"]*)"/gi, '')
    .replace(/\son\w+\s*=\s*'(?:[^']*)'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/href\s*=\s*"(?:javascript:|data:text\/html)[^"]*"/gi, 'href="#"')
    .replace(/src\s*=\s*"(?:javascript:|data:text\/html)[^"]*"/gi, 'src="#"');
}
