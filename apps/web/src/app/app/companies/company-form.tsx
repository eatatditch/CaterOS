'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createCompany, updateCompany } from '@/lib/actions/companies';
import { Field, inputCls, buttonPrimaryCls, buttonOutlineCls } from '@/components/ui/field';

export type CompanyInitial = {
  id?: string;
  name?: string;
  domain?: string | null;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
};

export function CompanyForm({ initial }: { initial?: CompanyInitial }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = initial?.id ? await updateCompany(initial.id, fd) : await createCompany(fd);
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
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" required defaultValue={initial?.name ?? ''} className={inputCls} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Industry" htmlFor="industry">
          <input id="industry" name="industry" defaultValue={initial?.industry ?? ''} className={inputCls} />
        </Field>
        <Field label="Domain" htmlFor="domain">
          <input id="domain" name="domain" defaultValue={initial?.domain ?? ''} className={inputCls} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Website" htmlFor="website">
          <input id="website" name="website" defaultValue={initial?.website ?? ''} className={inputCls} />
        </Field>
        <Field label="Phone" htmlFor="phone">
          <input id="phone" name="phone" defaultValue={initial?.phone ?? ''} className={inputCls} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="City" htmlFor="city">
          <input id="city" name="city" defaultValue={initial?.city ?? ''} className={inputCls} />
        </Field>
        <Field label="State/Region" htmlFor="region">
          <input id="region" name="region" defaultValue={initial?.region ?? ''} className={inputCls} />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2 pt-2">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Saving…' : initial?.id ? 'Save changes' : 'Create company'}
        </button>
        <button type="button" className={buttonOutlineCls} onClick={() => router.back()}>
          Cancel
        </button>
      </div>
    </form>
  );
}
