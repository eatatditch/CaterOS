'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, SlidersHorizontal, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteMenuItem,
  attachModifierGroup,
  detachModifierGroup,
} from '@/lib/actions/menus';
import { selectCls } from '@/components/ui/field';

type ModifierGroupOption = { id: string; name: string };

export function MenuItemRow({
  menuId,
  item,
  modifierGroups,
  attachedGroupIds,
}: {
  menuId: string;
  item: {
    id: string;
    name: string;
    description: string | null;
    unit: string;
    min_quantity: number;
    price: string;
    cost: string;
    margin: number;
  };
  modifierGroups: ModifierGroupOption[];
  attachedGroupIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModifiers, setShowModifiers] = useState(false);

  const attached = modifierGroups.filter((g) => attachedGroupIds.includes(g.id));
  const available = modifierGroups.filter((g) => !attachedGroupIds.includes(g.id));

  function onDelete() {
    if (!confirm(`Delete "${item.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteMenuItem(item.id, menuId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.refresh();
      }
    });
  }

  function onAttach(groupId: string) {
    if (!groupId) return;
    startTransition(async () => {
      const res = await attachModifierGroup(item.id, groupId, menuId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Modifier group attached');
        router.refresh();
      }
    });
  }

  function onDetach(groupId: string) {
    startTransition(async () => {
      const res = await detachModifierGroup(item.id, groupId, menuId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Detached');
        router.refresh();
      }
    });
  }

  return (
    <li className="px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1 pr-4">
          <div className="font-medium">{item.name}</div>
          {item.description ? (
            <div className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {item.description}
            </div>
          ) : null}
          <div className="mt-1 text-xs text-muted-foreground">
            {item.price} per {item.unit} · cost {item.cost} · margin {item.margin}% · min qty{' '}
            {item.min_quantity}
            {attached.length > 0 ? ` · ${attached.length} modifier group${attached.length === 1 ? '' : 's'}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowModifiers((v) => !v)}
            disabled={isPending}
            className="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            aria-label="Manage modifier groups"
            aria-expanded={showModifiers}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label="Delete item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showModifiers ? (
        <div className="mt-3 rounded-md border bg-muted/30 p-3">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Modifier groups</div>
          {attached.length > 0 ? (
            <ul className="mb-3 flex flex-wrap gap-2">
              {attached.map((g) => (
                <li
                  key={g.id}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs"
                >
                  {g.name}
                  <button
                    onClick={() => onDetach(g.id)}
                    disabled={isPending}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                    aria-label={`Detach ${g.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-xs text-muted-foreground">None attached.</p>
          )}
          {available.length > 0 ? (
            <label className="flex items-center gap-2 text-xs">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                defaultValue=""
                disabled={isPending}
                onChange={(e) => {
                  onAttach(e.target.value);
                  e.target.value = '';
                }}
                className={selectCls}
                aria-label="Attach modifier group"
              >
                <option value="" disabled>
                  Attach a modifier group…
                </option>
                {available.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          ) : modifierGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No modifier groups yet — create some under Menus → Modifiers.
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
