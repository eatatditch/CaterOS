'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { createCategory, renameCategory, deleteCategory } from '@/lib/actions/menus';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

type Category = { id: string; name: string; itemCount: number };

export function CategoriesPanel({
  menuId,
  categories,
}: {
  menuId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  function onCreate(fd: FormData) {
    startTransition(async () => {
      const res = await createCategory(menuId, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Category added');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  function onRename(id: string, fd: FormData) {
    startTransition(async () => {
      const res = await renameCategory(id, menuId, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Renamed');
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function onDelete(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteCategory(c.id, menuId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {categories.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {categories.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="p-2">
                <form
                  action={(fd) => onRename(c.id, fd)}
                  className="flex items-center gap-2"
                >
                  <input
                    name="name"
                    defaultValue={c.name}
                    required
                    className={inputCls}
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </form>
              </li>
            ) : (
              <li key={c.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">
                  {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.itemCount} {c.itemCount === 1 ? 'item' : 'items'}
                  </span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingId(c.id)}
                    disabled={isPending}
                    className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    aria-label="Rename category"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(c)}
                    disabled={isPending}
                    className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label="Delete category"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      )}

      <form ref={formRef} action={onCreate} className="space-y-2">
        <Field label="New category" htmlFor="category-name">
          <input
            id="category-name"
            name="name"
            required
            placeholder="e.g. Appetizers"
            className={inputCls}
          />
        </Field>
        <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
          <Plus className="h-4 w-4" /> Add category
        </button>
      </form>
    </div>
  );
}
