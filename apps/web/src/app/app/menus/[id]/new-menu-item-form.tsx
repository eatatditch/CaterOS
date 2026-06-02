'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createMenuItem } from '@/lib/actions/menus';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

const units = ['person', 'each', 'dozen', 'tray', 'gallon', 'pound'];

export function NewMenuItemForm({
  menuId,
  categories,
}: {
  menuId: string;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createMenuItem(menuId, fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Item added');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" required className={inputCls} />
      </Field>
      <Field label="Description" htmlFor="description">
        <textarea id="description" name="description" className={textareaCls} />
      </Field>
      {categories.length > 0 ? (
        <Field label="Category" htmlFor="category_id">
          <select id="category_id" name="category_id" className={selectCls} defaultValue="">
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Price ($)" htmlFor="price">
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            className={inputCls}
          />
        </Field>
        <Field label="Cost ($)" htmlFor="cost">
          <input id="cost" name="cost" type="number" step="0.01" min="0" className={inputCls} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Unit" htmlFor="unit">
          <select id="unit" name="unit" defaultValue="person" className={selectCls}>
            {units.map((u) => (
              <option key={u} value={u}>
                per {u}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Min qty" htmlFor="min_quantity">
          <input
            id="min_quantity"
            name="min_quantity"
            type="number"
            min="1"
            defaultValue={1}
            className={inputCls}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
        {isPending ? 'Adding…' : 'Add item'}
      </button>
    </form>
  );
}
