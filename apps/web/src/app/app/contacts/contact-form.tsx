'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createContact, updateContact } from '@/lib/actions/contacts';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
  buttonOutlineCls,
} from '@/components/ui/field';

const stages = [
  'subscriber',
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer',
  'evangelist',
  'other',
] as const;

export type ContactFormValues = {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  company_id?: string | null;
  lifecycle_stage?: string;
  lead_source?: string | null;
};

export function ContactForm({
  initial,
  companies,
}: {
  initial?: ContactFormValues;
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = initial?.id
        ? await updateContact(initial.id, fd)
        : await createContact(fd);
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
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First name" htmlFor="first_name">
          <input
            id="first_name"
            name="first_name"
            required
            defaultValue={initial?.first_name ?? ''}
            className={inputCls}
          />
        </Field>
        <Field label="Last name" htmlFor="last_name">
          <input
            id="last_name"
            name="last_name"
            defaultValue={initial?.last_name ?? ''}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={initial?.email ?? ''}
            className={inputCls}
          />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={initial?.phone ?? ''}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Job title" htmlFor="job_title">
          <input
            id="job_title"
            name="job_title"
            defaultValue={initial?.job_title ?? ''}
            className={inputCls}
          />
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

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Lifecycle stage" htmlFor="lifecycle_stage">
          <select
            id="lifecycle_stage"
            name="lifecycle_stage"
            defaultValue={initial?.lifecycle_stage ?? 'lead'}
            className={selectCls}
          >
            {stages.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lead source" htmlFor="lead_source" hint="e.g. referral, website, ad">
          <input
            id="lead_source"
            name="lead_source"
            defaultValue={initial?.lead_source ?? ''}
            className={inputCls}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create contact'}
        </button>
        <button
          type="button"
          className={buttonOutlineCls}
          onClick={() => router.back()}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
