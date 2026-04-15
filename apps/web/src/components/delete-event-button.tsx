'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteEvent } from '@/lib/actions/events';
import { cn } from '@/lib/utils';

export function DeleteEventButton({
  eventId,
  eventName,
  variant = 'button',
  afterDelete,
}: {
  eventId: string;
  eventName: string;
  variant?: 'button' | 'icon';
  afterDelete?: 'stay' | 'go-to-events';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const confirmed = confirm(
      `Delete event "${eventName}"? This removes it from the calendar and dispatch board.`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteEvent(eventId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Event deleted');
        if (afterDelete === 'go-to-events') router.push('/app/events');
        else router.refresh();
      }
    });
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={cn(
          'rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50',
        )}
        title="Delete event"
        aria-label="Delete event"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
      title="Delete event"
    >
      <Trash2 className="h-4 w-4" />
      {isPending ? 'Deleting…' : 'Delete'}
    </button>
  );
}
