'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createModifierGroup } from '@/lib/actions/menus';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

export function NewModifierGroupForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createModifierGroup(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Modifier group created');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      <Field label="Name" htmlFor="mg-name">
        <input id="mg-name" name="name" required placeholder="e.g. Choose 1 entrée" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min selections" htmlFor="mg-min">
          <input
            id="mg-min"
            name="min_selections"
            type="number"
            min="0"
            defaultValue={0}
            className={inputCls}
          />
        </Field>
        <Field label="Max selections" htmlFor="mg-max">
          <input
            id="mg-max"
            name="max_selections"
            type="number"
            min="1"
            defaultValue={1}
            className={inputCls}
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_required" className="h-4 w-4 rounded border" />
        Required
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
        {isPending ? 'Creating…' : 'Create group'}
      </button>
    </form>
  );
}
