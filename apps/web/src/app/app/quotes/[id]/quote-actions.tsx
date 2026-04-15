'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { deleteQuote, sendQuote, setQuoteStatus } from '@/lib/actions/quotes';
import {
  Field,
  inputCls,
  textareaCls,
  buttonPrimaryCls,
  buttonOutlineCls,
  buttonDestructiveCls,
} from '@/components/ui/field';

export function QuoteActions({
  id,
  number,
  status,
  contactEmail,
  contactName,
  publicToken,
  appUrl,
}: {
  id: string;
  number: string;
  status: string;
  contactEmail: string | null;
  contactName: string;
  publicToken: string | null;
  appUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const publicUrl = publicToken ? `${appUrl}/quote/${publicToken}` : null;

  function transition(next: 'sent' | 'accepted' | 'declined' | 'draft') {
    startTransition(async () => {
      const res = await setQuoteStatus(id, next);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Marked ${next}`);
        router.refresh();
      }
    });
  }

  async function copyPublicLink() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Link copied');
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(status === 'draft' || status === 'sent' || status === 'viewed') && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={buttonPrimaryCls}
          >
            <Send className="h-4 w-4" />
            {status === 'draft' ? 'Send quote' : 'Resend'}
          </button>
        )}

        {publicUrl ? (
          <button
            type="button"
            onClick={copyPublicLink}
            className={buttonOutlineCls}
            title="Copy public link"
          >
            <Copy className="h-4 w-4" />
            Copy link
          </button>
        ) : null}

        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonOutlineCls}
            title="Preview as client"
          >
            <ExternalLink className="h-4 w-4" />
            Preview
          </a>
        ) : null}

        {(status === 'sent' || status === 'viewed') && (
          <>
            <button
              type="button"
              disabled={isPending}
              onClick={() => transition('accepted')}
              className={buttonOutlineCls}
            >
              Mark accepted
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => transition('declined')}
              className={buttonOutlineCls}
            >
              Mark declined
            </button>
          </>
        )}

        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            const confirmed = confirm(
              `Delete quote ${number}? This can't be undone. Linked invoices with no payments will also be deleted.`,
            );
            if (!confirmed) return;
            startTransition(async () => {
              const res = await deleteQuote(id);
              if (res?.error) {
                toast.error(res.error);
              } else {
                toast.success('Quote deleted');
                router.push('/app/quotes');
              }
            });
          }}
          className={buttonDestructiveCls}
          title="Delete quote"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {dialogOpen ? (
        <SendDialog
          quoteId={id}
          quoteNumber={number}
          contactEmail={contactEmail}
          contactName={contactName}
          onClose={() => setDialogOpen(false)}
          onSent={() => {
            setDialogOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function SendDialog({
  quoteId,
  quoteNumber,
  contactEmail,
  contactName,
  onClose,
  onSent,
}: {
  quoteId: string;
  quoteNumber: string;
  contactEmail: string | null;
  contactName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(contactEmail ?? '');
  const [subject, setSubject] = useState(`Your catering quote ${quoteNumber}`);
  const [message, setMessage] = useState(
    `Hi ${contactName || 'there'},\n\nAttached is the quote for your upcoming event. Please review and click "Accept quote" when you're ready to move forward — or reply to this email with any questions.\n\nThanks!`,
  );
  const [isSending, startSending] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    if (!to || !subject) {
      setError('Recipient and subject required');
      return;
    }
    startSending(async () => {
      const res = await sendQuote({
        quote_id: quoteId,
        to,
        subject,
        message,
      });
      if (res && 'error' in res && res.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Quote sent');
        onSent();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center">
      <div
        className="relative w-full max-w-lg rounded-lg border bg-card shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">Send quote {quoteNumber}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded p-2 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-6 py-5">
          <Field label="To" htmlFor="send-to">
            <input
              id="send-to"
              type="email"
              required
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
              placeholder="client@example.com"
            />
          </Field>
          <Field label="Subject" htmlFor="send-subject">
            <input
              id="send-subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field
            label="Personal message"
            htmlFor="send-message"
            hint="Appears at the top of the email, above the quote summary."
          >
            <textarea
              id="send-message"
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={textareaCls}
            />
          </Field>

          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            The email will include a formatted quote summary (line items + totals)
            and an <strong>Accept quote</strong> button. Clicking it moves the deal
            to <strong>Booked</strong> automatically.
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button type="button" onClick={onClose} className={buttonOutlineCls}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSending}
            className={buttonPrimaryCls}
          >
            <Send className="h-4 w-4" />
            {isSending ? 'Sending…' : 'Send quote'}
          </button>
        </footer>
      </div>
    </div>
  );
}
