'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createActivity } from '@/lib/actions/activities';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

const types = [
  'note',
  'call',
  'email',
  'meeting',
  'task',
  'site_visit',
  'tasting',
  'proposal_send',
  'follow_up',
  'networking',
] as const;

const QUICK_ACTIONS = [
  { type: 'call', label: 'Call', icon: '📞' },
  { type: 'email', label: 'Email', icon: '✉️' },
  { type: 'meeting', label: 'Meeting', icon: '🤝' },
  { type: 'tasting', label: 'Tasting', icon: '🍽️' },
] as const;

export function NewActivityForm({
  contactId,
  dealId,
  companyId,
  prospectId,
}: {
  contactId?: string;
  dealId?: string;
  companyId?: string;
  prospectId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function logQuick(type: string) {
    const fd = new FormData();
    fd.set('type', type);
    submit(fd);
  }

  function submit(fd: FormData) {
    setError(null);
    if (contactId) fd.set('contact_id', contactId);
    if (dealId) fd.set('deal_id', dealId);
    if (companyId) fd.set('company_id', companyId);
    if (prospectId) fd.set('prospect_id', prospectId);
    startTransition(async () => {
      const res = await createActivity(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Activity logged');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  function onSubmit(fd: FormData) {
    setError(null);
    if (contactId) fd.set('contact_id', contactId);
    if (dealId) fd.set('deal_id', dealId);
    if (companyId) fd.set('company_id', companyId);
    if (prospectId) fd.set('prospect_id', prospectId);
    startTransition(async () => {
      const res = await createActivity(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Activity logged');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Quick-tap row — one-tap logging on mobile */}
      <div className="grid grid-cols-4 gap-2">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q.type}
            type="button"
            disabled={isPending}
            onClick={() => logQuick(q.type)}
            className="flex flex-col items-center gap-1 rounded-md border bg-card py-3 text-xs font-medium hover:bg-accent/40 disabled:opacity-50"
          >
            <span className="text-lg">{q.icon}</span>
            {q.label}
          </button>
        ))}
      </div>

      <form ref={formRef} action={onSubmit} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[140px_1fr]">
        <Field label="Type" htmlFor="type">
          <select id="type" name="type" defaultValue="note" className={selectCls}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject" htmlFor="subject">
          <input id="subject" name="subject" placeholder="Short summary…" className={inputCls} />
        </Field>
      </div>
      <Field label="Details" htmlFor="body">
        <textarea id="body" name="body" className={textareaCls} />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Logging…' : 'Log activity'}
        </button>
      </div>
      </form>
    </div>
  );
}
