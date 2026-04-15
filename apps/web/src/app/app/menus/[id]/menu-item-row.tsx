'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteMenuItem } from '@/lib/actions/menus';

export function MenuItemRow({
  menuId,
  item,
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
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  return (
    <li className="flex items-center justify-between px-6 py-4">
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
        </div>
      </div>
      <button
        onClick={onDelete}
        disabled={isPending}
        className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}
