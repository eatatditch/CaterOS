'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createDeal, updateDeal } from '@/lib/actions/deals';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
  buttonOutlineCls,
} from '@/components/ui/field';

export type DealInitial = {
  id?: string;
  title?: string;
  amount_cents?: number;
  contact_id?: string | null;
  company_id?: string | null;
  pipeline_id?: string;
  stage_id?: string;
  expected_close_date?: string | null;
  estimated_event_date?: string | null;
  source?: string | null;
  source_detail?: string | null;
  location_id?: string | null;
  event_type?: string | null;
  lost_reason?: string | null;
};

const LEAD_SOURCES = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'referral', label: 'Referral' },
  { value: 'paid_ad', label: 'Paid ad' },
  { value: 'event', label: 'Event / networking' },
  { value: 'walkup', label: 'Walk-up' },
] as const;

const EVENT_TYPES = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'social', label: 'Social' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'other', label: 'Other' },
] as const;

export function DealForm({
  initial,
  pipelineId,
  stages,
  contacts,
  companies,
  locations,
}: {
  initial?: DealInitial;
  pipelineId: string;
  stages: { id: string; name: string; position: number }[];
  contacts: { id: string; label: string }[];
  companies: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    fd.set('pipeline_id', initial?.pipeline_id ?? pipelineId);
    startTransition(async () => {
      const res = initial?.id ? await updateDeal(initial.id, fd) : await createDeal(fd);
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
      <Field label="Deal title" htmlFor="title">
        <input
          id="title"
          name="title"
          required
          defaultValue={initial?.title ?? ''}
          placeholder="e.g. Widget Co. holiday party 2026"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Amount ($)" htmlFor="amount">
          <input
            id="amount"
            name="amount"
            type="number"
            step="0.01"
            min="0"
            defaultValue={initial?.amount_cents ? (initial.amount_cents / 100).toFixed(2) : ''}
            className={inputCls}
          />
        </Field>
        <Field label="Event date" htmlFor="expected_close_date">
          <input
            id="expected_close_date"
            name="expected_close_date"
            type="date"
            defaultValue={
              initial?.expected_close_date
                ? new Date(initial.expected_close_date).toISOString().slice(0, 10)
                : ''
            }
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Stage" htmlFor="stage_id">
          <select
            id="stage_id"
            name="stage_id"
            required
            defaultValue={initial?.stage_id ?? stages[0]?.id ?? ''}
            className={selectCls}
          >
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source" htmlFor="source">
          <select
            id="source"
            name="source"
            defaultValue={initial?.source ?? ''}
            className={selectCls}
          >
            <option value="">—</option>
            {LEAD_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Source detail" htmlFor="source_detail">
          <input
            id="source_detail"
            name="source_detail"
            defaultValue={initial?.source_detail ?? ''}
            placeholder="Meta, Google, Jane Doe…"
            className={inputCls}
          />
        </Field>
        <Field label="Event type" htmlFor="event_type">
          <select
            id="event_type"
            name="event_type"
            defaultValue={initial?.event_type ?? ''}
            className={selectCls}
          >
            <option value="">—</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
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
        <Field label="Estimated event date" htmlFor="estimated_event_date">
          <input
            id="estimated_event_date"
            name="estimated_event_date"
            type="date"
            defaultValue={
              initial?.estimated_event_date
                ? new Date(initial.estimated_event_date).toISOString().slice(0, 10)
                : ''
            }
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
        <Field label="Company" htmlFor="company_id">
          <select
            id="company_id"
            name="company_id"
            defaultValue={initial?.company_id ?? ''}
            className={selectCls}
          >
            <option value="">—</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Lost reason (only if marking lost)" htmlFor="lost_reason">
        <input
          id="lost_reason"
          name="lost_reason"
          defaultValue={initial?.lost_reason ?? ''}
          placeholder="Price, timing, lost to competitor…"
          className={inputCls}
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create deal'}
        </button>
        <button type="button" className={buttonOutlineCls} onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
