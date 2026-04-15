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

const types = ['note', 'call', 'email', 'meeting', 'task'] as const;

export function NewActivityForm({
  contactId,
  dealId,
  companyId,
}: {
  contactId?: string;
  dealId?: string;
  companyId?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    if (contactId) fd.set('contact_id', contactId);
    if (dealId) fd.set('deal_id', dealId);
    if (companyId) fd.set('company_id', companyId);
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
  );
}
