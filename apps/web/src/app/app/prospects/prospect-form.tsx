'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createProspect, updateProspect } from '@/lib/actions/prospects';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
  buttonOutlineCls,
} from '@/components/ui/field';

const SEGMENTS = [
  { value: 'corporate_office', label: 'Corporate office' },
  { value: 'wedding_venue', label: 'Wedding venue' },
  { value: 'event_planner', label: 'Event planner' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'school', label: 'School' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other' },
] as const;

const STATUSES = [
  { value: 'cold', label: 'Cold' },
  { value: 'warming', label: 'Warming' },
  { value: 'converted_to_lead', label: 'Converted to lead' },
  { value: 'dead', label: 'Dead' },
] as const;

export type ProspectInitial = {
  id?: string;
  company_name?: string;
  contact_name?: string | null;
  segment?: string;
  status?: string;
  location_id?: string | null;
  next_touch_at?: string | null;
  notes?: string | null;
  contact_info?: { email?: string | null; phone?: string | null } | null;
};

export function ProspectForm({
  initial,
  locations,
}: {
  initial?: ProspectInitial;
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = initial?.id
        ? await updateProspect(initial.id, fd)
        : await createProspect(fd);
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
      <Field label="Company name" htmlFor="company_name">
        <input
          id="company_name"
          name="company_name"
          required
          defaultValue={initial?.company_name ?? ''}
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contact name" htmlFor="contact_name">
          <input
            id="contact_name"
            name="contact_name"
            defaultValue={initial?.contact_name ?? ''}
            className={inputCls}
          />
        </Field>
        <Field label="Segment" htmlFor="segment">
          <select
            id="segment"
            name="segment"
            required
            defaultValue={initial?.segment ?? 'other'}
            className={selectCls}
          >
            {SEGMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={initial?.contact_info?.email ?? ''}
            className={inputCls}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            defaultValue={initial?.contact_info?.phone ?? ''}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Location" htmlFor="location_id">
          <select
            id="location_id"
            name="location_id"
            defaultValue={initial?.location_id ?? ''}
            className={selectCls}
          >
            <option value="">—</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? 'cold'}
            className={selectCls}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Next touch date" htmlFor="next_touch_at">
        <input
          id="next_touch_at"
          name="next_touch_at"
          type="date"
          defaultValue={
            initial?.next_touch_at
              ? new Date(initial.next_touch_at).toISOString().slice(0, 10)
              : ''
          }
          className={inputCls}
        />
      </Field>

      <Field label="Notes" htmlFor="notes">
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={initial?.notes ?? ''}
          className={inputCls}
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create prospect'}
        </button>
        <button type="button" className={buttonOutlineCls} onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
