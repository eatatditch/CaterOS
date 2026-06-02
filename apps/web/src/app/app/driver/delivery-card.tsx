'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Clock, MapPin, Users, Phone, Navigation, CheckCircle2, CloudOff } from 'lucide-react';
import { setDispatchStatus } from '@/lib/actions/dispatch';
import { DISPATCH_STATUSES, type DispatchStatus } from '@/lib/dispatch/statuses';

export type Delivery = {
  id: string;
  name: string;
  serviceType: string;
  startsAt: string;
  venueName: string | null;
  venueAddress: string | null;
  headcount: number | null;
  contactName: string;
  contactPhone: string | null;
  status: DispatchStatus;
};

const STATUS_LABELS: Record<DispatchStatus, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  en_route: 'En route',
  arrived: 'Arrived',
  delivered: 'Delivered',
  completed: 'Completed',
};

// What the "advance" button says for each current status.
const NEXT_ACTION: Partial<Record<DispatchStatus, string>> = {
  assigned: 'Start drive',
  en_route: 'Mark arrived',
  arrived: 'Mark delivered',
  delivered: 'Complete',
};

function nextStatus(s: DispatchStatus): DispatchStatus | null {
  const i = DISPATCH_STATUSES.indexOf(s);
  if (i < 0 || i >= DISPATCH_STATUSES.length - 1) return null;
  return DISPATCH_STATUSES[i + 1] ?? null;
}

const QUEUE_KEY = 'cateros.dispatch.queue';
type Queue = Record<string, DispatchStatus>;

function readQueue(): Queue {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeQueue(next: Queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable; ignore */
  }
}

export function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const router = useRouter();
  const [status, setStatus] = useState<DispatchStatus>(delivery.status);
  const [queued, setQueued] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Persist a pending update and reflect it in the UI.
  const enqueue = useCallback((target: DispatchStatus) => {
    const q = readQueue();
    q[delivery.id] = target;
    writeQueue(q);
    setQueued(true);
  }, [delivery.id]);

  const dequeue = useCallback(() => {
    const q = readQueue();
    delete q[delivery.id];
    writeQueue(q);
    setQueued(false);
  }, [delivery.id]);

  // Try to push a status to the server; queue it on failure (offline).
  const push = useCallback(
    (target: DispatchStatus) =>
      startTransition(async () => {
        try {
          const res = await setDispatchStatus(delivery.id, target);
          if (res?.error) {
            toast.error(res.error);
            return;
          }
          dequeue();
          setStatus(target);
          router.refresh();
        } catch {
          // Network failure → keep it queued, optimistic UI, sync later.
          enqueue(target);
          setStatus(target);
          toast.message('Saved offline — will sync when you reconnect');
        }
      }),
    [delivery.id, dequeue, enqueue, router],
  );

  // On mount and whenever we come back online, flush any queued update.
  useEffect(() => {
    const flush = () => {
      const target = readQueue()[delivery.id];
      if (target && navigator.onLine) push(target);
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [delivery.id, push]);

  const next = nextStatus(status);
  const mapsHref = delivery.venueAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(delivery.venueAddress)}`
    : null;
  const time = new Date(delivery.startsAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Clock className="h-4 w-4" /> {time}
            <span className="ml-1 font-normal capitalize text-muted-foreground">
              · {delivery.serviceType.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-0.5 text-base font-semibold">{delivery.name}</div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            status === 'delivered' || status === 'completed'
              ? 'bg-green-100 text-green-800'
              : status === 'en_route' || status === 'arrived'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-muted text-muted-foreground'
          }`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {delivery.venueName ?? 'No venue'}
            {delivery.venueAddress ? ` · ${delivery.venueAddress}` : ''}
          </span>
        </div>
        {delivery.headcount ? (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" /> {delivery.headcount} guests
          </div>
        ) : null}
        {delivery.contactName ? (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" /> {delivery.contactName}
            {delivery.contactPhone ? ` · ${delivery.contactPhone}` : ''}
          </div>
        ) : null}
      </div>

      {queued ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600">
          <CloudOff className="h-3.5 w-3.5" /> Update saved offline — will sync
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-medium active:scale-[0.98]"
          >
            <Navigation className="h-4 w-4" /> Directions
          </a>
        ) : (
          <span />
        )}
        {delivery.contactPhone ? (
          <a
            href={`tel:${delivery.contactPhone}`}
            className="flex items-center justify-center gap-1.5 rounded-xl border py-3 text-sm font-medium active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
        ) : (
          <span />
        )}
      </div>

      {next ? (
        <button
          type="button"
          onClick={() => push(next)}
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          <CheckCircle2 className="h-5 w-5" />
          {isPending ? 'Saving…' : (NEXT_ACTION[status] ?? 'Advance')}
        </button>
      ) : (
        <div className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-green-100 py-4 text-base font-semibold text-green-800">
          <CheckCircle2 className="h-5 w-5" /> Delivered
        </div>
      )}
    </div>
  );
}
