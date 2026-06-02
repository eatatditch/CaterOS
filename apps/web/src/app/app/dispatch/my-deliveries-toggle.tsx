'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export function MyDeliveriesToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const mine = params.get('mine') === '1';

  function toggle() {
    const next = new URLSearchParams(params.toString());
    if (mine) next.delete('mine');
    else next.set('mine', '1');
    const qs = next.toString();
    router.push(qs ? `/app/dispatch?${qs}` : '/app/dispatch');
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium',
        mine
          ? 'border-primary bg-primary text-primary-foreground'
          : 'hover:bg-accent text-foreground',
      )}
      aria-pressed={mine}
    >
      My deliveries
    </button>
  );
}
