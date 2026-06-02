'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  updateModifierGroup,
  deleteModifierGroup,
  createModifier,
  updateModifier,
  deleteModifier,
} from '@/lib/actions/menus';
import { inputCls, buttonOutlineCls } from '@/components/ui/field';

type Group = {
  id: string;
  name: string;
  is_required: boolean;
  min_selections: number;
  max_selections: number;
};

type Modifier = { id: string; name: string; price_delta_cents: number; price: string };

export function ModifierGroupCard({
  group,
  modifiers,
}: {
  group: Group;
  modifiers: Modifier[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingGroup, setEditingGroup] = useState(false);
  const [editingModId, setEditingModId] = useState<string | null>(null);
  const addRef = useRef<HTMLFormElement>(null);

  function run(fn: () => Promise<{ error?: string } | { ok: true } | undefined>, success: string, after?: () => void) {
    startTransition(async () => {
      const res = await fn();
      if (res && 'error' in res && res.error) toast.error(res.error);
      else {
        toast.success(success);
        after?.();
        router.refresh();
      }
    });
  }

  function onDeleteGroup() {
    if (!confirm(`Delete modifier group "${group.name}" and all its options?`)) return;
    run(() => deleteModifierGroup(group.id), 'Deleted');
  }

  return (
    <div className="rounded-lg border bg-card">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-3">
        {editingGroup ? (
          <form
            action={(fd) =>
              run(() => updateModifierGroup(group.id, fd), 'Saved', () => setEditingGroup(false))
            }
            className="flex-1 space-y-2"
          >
            <input name="name" defaultValue={group.name} required className={inputCls} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="min_selections"
                type="number"
                min="0"
                defaultValue={group.min_selections}
                className={inputCls}
                aria-label="Min selections"
              />
              <input
                name="max_selections"
                type="number"
                min="1"
                defaultValue={group.max_selections}
                className={inputCls}
                aria-label="Max selections"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="is_required"
                defaultChecked={group.is_required}
                className="h-4 w-4 rounded border"
              />
              Required
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className={buttonOutlineCls}>
                <Check className="h-4 w-4" /> Save
              </button>
              <button
                type="button"
                onClick={() => setEditingGroup(false)}
                className={buttonOutlineCls}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div>
              <div className="font-semibold">{group.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {group.is_required ? 'Required · ' : ''}choose {group.min_selections}–
                {group.max_selections}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingGroup(true)}
                disabled={isPending}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Edit group"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                onClick={onDeleteGroup}
                disabled={isPending}
                className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                aria-label="Delete group"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </header>

      <ul className="divide-y">
        {modifiers.map((m) =>
          editingModId === m.id ? (
            <li key={m.id} className="p-3">
              <form
                action={(fd) =>
                  run(() => updateModifier(m.id, fd), 'Saved', () => setEditingModId(null))
                }
                className="flex items-center gap-2"
              >
                <input name="name" defaultValue={m.name} required className={inputCls} autoFocus />
                <input
                  name="price_delta"
                  type="number"
                  step="0.01"
                  defaultValue={(m.price_delta_cents / 100).toFixed(2)}
                  className={`${inputCls} w-28`}
                  aria-label="Price delta ($)"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label="Save modifier"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingModId(null)}
                  className="rounded p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            </li>
          ) : (
            <li key={m.id} className="flex items-center justify-between px-5 py-2.5">
              <div className="text-sm">
                {m.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {m.price_delta_cents >= 0 ? '+' : ''}
                  {m.price}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditingModId(m.id)}
                  disabled={isPending}
                  className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                  aria-label="Edit modifier"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => run(() => deleteModifier(m.id), 'Removed')}
                  disabled={isPending}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  aria-label="Remove modifier"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ),
        )}
        {modifiers.length === 0 ? (
          <li className="px-5 py-2.5 text-sm text-muted-foreground">No options yet.</li>
        ) : null}
      </ul>

      <form
        ref={addRef}
        action={(fd) => run(() => createModifier(group.id, fd), 'Option added', () => addRef.current?.reset())}
        className="flex items-center gap-2 border-t px-5 py-3"
      >
        <input name="name" required placeholder="Option name" className={inputCls} />
        <input
          name="price_delta"
          type="number"
          step="0.01"
          defaultValue="0.00"
          placeholder="$ +/-"
          className={`${inputCls} w-28`}
          aria-label="Price delta ($)"
        />
        <button type="submit" disabled={isPending} className={buttonOutlineCls}>
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
    </div>
  );
}
