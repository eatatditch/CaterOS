'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createSequence } from '@/lib/actions/marketing';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

const TRIGGERS: Array<{ value: string; label: string; hint: string }> = [
  { value: 'inbound_lead', label: 'Inbound lead captured', hint: 'Contact submits web form or is created manually.' },
  { value: 'quote_sent', label: 'Quote sent', hint: 'You emailed the client a quote.' },
  { value: 'quote_accepted', label: 'Quote accepted', hint: 'Client accepted the quote.' },
  { value: 'event_completed', label: 'Event completed', hint: 'After the event date passes.' },
  { value: 'annual_rebook', label: 'Annual rebook', hint: '1 year after last accepted quote.' },
  { value: 'abandoned_quote', label: 'Abandoned quote', hint: 'Quote sent but not opened after N days.' },
  { value: 'manual', label: 'Manual enrollment', hint: 'Enroll contacts from their detail page.' },
];

export function NewSequenceForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState('manual');

  const currentTrigger = TRIGGERS.find((t) => t.value === trigger);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createSequence(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label="Name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          placeholder="Post-event thank-you"
          className={inputCls}
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <textarea id="description" name="description" rows={2} className={textareaCls} />
      </Field>

      <Field label="Trigger" htmlFor="trigger">
        <select
          id="trigger"
          name="trigger"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className={selectCls}
        >
          {TRIGGERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {currentTrigger ? (
          <div className="mt-1 text-xs text-muted-foreground">{currentTrigger.hint}</div>
        ) : null}
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
        {isPending ? 'Creating…' : 'Create sequence'}
      </button>
    </form>
  );
}
