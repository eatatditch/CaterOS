'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, DollarSign, ExternalLink, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@cateros/lib/money';
import { deleteQuote, sendQuote, setQuoteStatus } from '@/lib/actions/quotes';
import { recordManualPaymentForQuote } from '@/lib/actions/billing';
import type { ManualPaymentMethod } from '@/lib/billing/payment-methods';
import {
  Field,
  inputCls,
  selectCls,
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
  totalCents,
  currency,
  depositRate,
  invoiceId,
  invoiceTotalCents,
  invoiceAmountPaidCents,
}: {
  id: string;
  number: string;
  status: string;
  contactEmail: string | null;
  contactName: string;
  publicToken: string | null;
  appUrl: string;
  totalCents: number;
  currency: string;
  depositRate: number;
  invoiceId: string | null;
  invoiceTotalCents: number | null;
  invoiceAmountPaidCents: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);

  const publicUrl = publicToken ? `${appUrl}/quote/${publicToken}` : null;
  const canTakeDeposit =
    status !== 'declined' && status !== 'expired' && status !== 'converted';
  const remainingFromInvoice =
    invoiceTotalCents !== null && invoiceAmountPaidCents !== null
      ? invoiceTotalCents - invoiceAmountPaidCents
      : null;
  const remainingCents = remainingFromInvoice ?? totalCents;
  const suggestedDepositCents =
    remainingFromInvoice !== null
      ? remainingFromInvoice
      : Math.round(totalCents * depositRate);

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

        {canTakeDeposit && remainingCents > 0 ? (
          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className={buttonOutlineCls}
            title="Record cash, check, or in-person card payment"
          >
            <DollarSign className="h-4 w-4" />
            Record deposit
          </button>
        ) : null}

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

      {depositOpen ? (
        <DepositDialog
          quoteId={id}
          quoteNumber={number}
          status={status}
          currency={currency}
          remainingCents={remainingCents}
          suggestedCents={suggestedDepositCents}
          hasInvoice={invoiceId !== null}
          onClose={() => setDepositOpen(false)}
          onRecorded={(invoiceId) => {
            setDepositOpen(false);
            router.refresh();
            if (invoiceId) {
              toast.success('Deposit recorded');
            }
          }}
        />
      ) : null}
    </>
  );
}

function todayLocalIso() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

const METHOD_OPTIONS: { value: ManualPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card_in_person', label: 'Card (in person)' },
  { value: 'ach', label: 'ACH / Bank transfer' },
  { value: 'other', label: 'Other' },
];

function DepositDialog({
  quoteId,
  quoteNumber,
  status,
  currency,
  remainingCents,
  suggestedCents,
  hasInvoice,
  onClose,
  onRecorded,
}: {
  quoteId: string;
  quoteNumber: string;
  status: string;
  currency: string;
  remainingCents: number;
  suggestedCents: number;
  hasInvoice: boolean;
  onClose: () => void;
  onRecorded: (invoiceId: string | null) => void;
}) {
  const [amount, setAmount] = useState<string>(() =>
    (Math.max(suggestedCents, 0) / 100).toFixed(2),
  );
  const [method, setMethod] = useState<ManualPaymentMethod>('cash');
  const [receivedAt, setReceivedAt] = useState<string>(todayLocalIso);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const willAcceptQuote = !hasInvoice && status !== 'accepted';

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const dollars = Number(amount);
    if (!isFinite(dollars) || dollars <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    const cents = Math.round(dollars * 100);
    if (cents > remainingCents) {
      setError(
        `Amount can’t exceed the remaining balance of ${formatMoney(remainingCents, currency)}.`,
      );
      return;
    }

    startSaving(async () => {
      const res = await recordManualPaymentForQuote({
        quote_id: quoteId,
        amount_cents: cents,
        method,
        received_at: new Date(receivedAt + 'T12:00:00').toISOString(),
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      });

      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      onRecorded(res.data?.invoice_id ?? null);
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
          <h2 className="font-semibold">Record deposit · {quoteNumber}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded p-2 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
          {willAcceptQuote ? (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
              Recording a deposit will <strong>accept this quote</strong> and
              generate the invoice automatically.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Amount"
              htmlFor="deposit-amount"
              hint={`Balance ${formatMoney(remainingCents, currency)}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  id="deposit-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                  required
                />
              </div>
            </Field>

            <Field label="Method" htmlFor="deposit-method">
              <select
                id="deposit-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as ManualPaymentMethod)}
                className={selectCls}
              >
                {METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Received on" htmlFor="deposit-received-at">
              <input
                id="deposit-received-at"
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className={inputCls}
                required
              />
            </Field>

            <Field
              label="Reference"
              htmlFor="deposit-reference"
              hint="Check #, last 4 of card, transaction ID…"
            >
              <input
                id="deposit-reference"
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={inputCls}
                maxLength={120}
              />
            </Field>
          </div>

          <Field label="Note" htmlFor="deposit-note">
            <textarea
              id="deposit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={textareaCls}
              maxLength={500}
              placeholder="Optional — anything you’d like to remember about this payment."
            />
          </Field>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 border-t px-0 pt-4">
            <button type="button" onClick={onClose} className={buttonOutlineCls}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className={buttonPrimaryCls}>
              <DollarSign className="h-4 w-4" />
              {isSaving ? 'Recording…' : 'Record deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
