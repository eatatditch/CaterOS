'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatMoney } from '@cateros/lib/money';
import {
  recordManualPayment,
  type ManualPaymentMethod,
} from '@/lib/actions/billing';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

const METHOD_OPTIONS: { value: ManualPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'card_in_person', label: 'Card (in person)' },
  { value: 'ach', label: 'ACH / Bank transfer' },
  { value: 'other', label: 'Other' },
];

function todayLocalIso() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function RecordPaymentForm({
  invoiceId,
  remainingCents,
  currency,
  canRecord,
}: {
  invoiceId: string;
  remainingCents: number;
  currency: string;
  canRecord: boolean;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<string>(() =>
    (Math.max(remainingCents, 0) / 100).toFixed(2),
  );
  const [method, setMethod] = useState<ManualPaymentMethod>('cash');
  const [receivedAt, setReceivedAt] = useState<string>(todayLocalIso);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  if (!canRecord) {
    return (
      <p className="text-sm text-muted-foreground">
        Only owners and managers can record payments.
      </p>
    );
  }

  if (remainingCents <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This invoice is fully paid — no balance remaining.
      </p>
    );
  }

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
      const res = await recordManualPayment({
        invoice_id: invoiceId,
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
      toast.success('Payment recorded');
      setAmount('0.00');
      setReference('');
      setNote('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount" htmlFor="amount" hint={`Balance ${formatMoney(remainingCents, currency)}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">$</span>
            <input
              id="amount"
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

        <Field label="Method" htmlFor="method">
          <select
            id="method"
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

        <Field label="Received on" htmlFor="received_at">
          <input
            id="received_at"
            type="date"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className={inputCls}
            required
          />
        </Field>

        <Field
          label="Reference"
          htmlFor="reference"
          hint="Check #, last 4 of card, transaction ID…"
        >
          <input
            id="reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={inputCls}
            maxLength={120}
          />
        </Field>
      </div>

      <Field label="Note" htmlFor="note">
        <textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={textareaCls}
          maxLength={500}
          placeholder="Optional — anything you’d like to remember about this payment."
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isSaving} className={buttonPrimaryCls}>
        {isSaving ? 'Recording…' : 'Record payment'}
      </button>
    </form>
  );
}
