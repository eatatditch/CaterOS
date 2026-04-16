'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { completeProfile } from '@/lib/actions/profile';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

export function WelcomeForm({
  initial,
}: {
  initial: { first_name: string; last_name: string; phone: string };
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await completeProfile(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name">
          <input
            id="first_name"
            name="first_name"
            type="text"
            required
            maxLength={80}
            defaultValue={initial.first_name}
            autoComplete="given-name"
            className={inputCls}
          />
        </Field>
        <Field label="Last name" htmlFor="last_name">
          <input
            id="last_name"
            name="last_name"
            type="text"
            required
            maxLength={80}
            defaultValue={initial.last_name}
            autoComplete="family-name"
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Phone" htmlFor="phone" hint="Used for SMS dispatch alerts (optional).">
        <input
          id="phone"
          name="phone"
          type="tel"
          maxLength={40}
          defaultValue={initial.phone}
          autoComplete="tel"
          className={inputCls}
        />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
        {isPending ? 'Saving…' : 'Continue to app'}
      </button>
    </form>
  );
}
