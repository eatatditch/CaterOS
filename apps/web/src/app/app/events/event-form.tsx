'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createEvent, updateEvent } from '@/lib/actions/events';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
  buttonOutlineCls,
} from '@/components/ui/field';

const services = ['delivery', 'pickup', 'full_service', 'drop_off', 'buffet', 'plated'] as const;
const statuses = [
  'tentative',
  'confirmed',
  'in_prep',
  'in_progress',
  'delivered',
  'completed',
  'cancelled',
] as const;

export type EventInitial = {
  id?: string;
  name?: string;
  status?: string;
  service_type?: string;
  headcount?: number;
  starts_at?: string;
  ends_at?: string;
  venue_name?: string | null;
  venue_address?: string | null;
  notes?: string | null;
  contact_id?: string | null;
};

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventForm({
  initial,
  contacts,
}: {
  initial?: EventInitial;
  contacts: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = initial?.id ? await updateEvent(initial.id, fd) : await createEvent(fd);
      if (res && 'error' in res && res.error) {
        setError(res.error);
        toast.error(res.error);
      } else if (res && 'ok' in res) {
        toast.success('Saved');
        router.refresh();
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label="Event name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          defaultValue={initial?.name ?? ''}
          placeholder="e.g. Smith Wedding Rehearsal Dinner"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? 'tentative'}
            className={selectCls}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service type" htmlFor="service_type">
          <select
            id="service_type"
            name="service_type"
            defaultValue={initial?.service_type ?? 'delivery'}
            className={selectCls}
          >
            {services.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Head count" htmlFor="headcount">
          <input
            id="headcount"
            name="headcount"
            type="number"
            min="0"
            defaultValue={initial?.headcount ?? 0}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Starts at" htmlFor="starts_at">
          <input
            id="starts_at"
            name="starts_at"
            type="datetime-local"
            required
            defaultValue={toLocalInput(initial?.starts_at)}
            className={inputCls}
          />
        </Field>
        <Field label="Ends at" htmlFor="ends_at">
          <input
            id="ends_at"
            name="ends_at"
            type="datetime-local"
            required
            defaultValue={toLocalInput(initial?.ends_at)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Venue name" htmlFor="venue_name">
          <input
            id="venue_name"
            name="venue_name"
            defaultValue={initial?.venue_name ?? ''}
            className={inputCls}
          />
        </Field>
        <Field label="Contact" htmlFor="contact_id">
          <select
            id="contact_id"
            name="contact_id"
            defaultValue={initial?.contact_id ?? ''}
            className={selectCls}
          >
            <option value="">—</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label || '(no name)'}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Venue address" htmlFor="venue_address">
        <input
          id="venue_address"
          name="venue_address"
          defaultValue={initial?.venue_address ?? ''}
          className={inputCls}
        />
      </Field>

      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" defaultValue={initial?.notes ?? ''} className={textareaCls} />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create event'}
        </button>
        <button type="button" className={buttonOutlineCls} onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
