'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createMenu } from '@/lib/actions/menus';
import {
  Field,
  inputCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

export function NewMenuForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createMenu(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          placeholder="e.g. Corporate Lunch Menu"
          className={inputCls}
        />
      </Field>
      <Field label="Description" htmlFor="description">
        <textarea id="description" name="description" className={textareaCls} />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
        {isPending ? 'Creating…' : 'Create menu'}
      </button>
    </form>
  );
}
