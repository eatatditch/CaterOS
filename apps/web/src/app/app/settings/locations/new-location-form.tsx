'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createLocation } from '@/lib/actions/locations';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

export function NewLocationForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createLocation(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Location added');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          placeholder="Downtown Kitchen"
          className={inputCls}
        />
      </Field>
      <Field label="Address" htmlFor="address_line_1">
        <input id="address_line_1" name="address_line_1" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="City" htmlFor="city">
          <input id="city" name="city" className={inputCls} />
        </Field>
        <Field label="State" htmlFor="region">
          <input id="region" name="region" className={inputCls} />
        </Field>
      </div>
      <Field label="Phone" htmlFor="phone">
        <input id="phone" name="phone" type="tel" className={inputCls} />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
        {isPending ? 'Adding…' : 'Add location'}
      </button>
    </form>
  );
}
