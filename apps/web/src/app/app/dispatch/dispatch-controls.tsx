'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { selectCls } from '@/components/ui/field';
import {
  assignDriver,
  setDispatchStatus,
  DISPATCH_STATUSES,
  type DispatchStatus,
} from '@/lib/actions/dispatch';

export type DriverOption = { id: string; name: string; role: string };

const STATUS_LABELS: Record<DispatchStatus, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  en_route: 'En route',
  arrived: 'Arrived',
  delivered: 'Delivered',
  completed: 'Completed',
};

export function DriverSelect({
  eventId,
  driverId,
  drivers,
  canAssign,
}: {
  eventId: string;
  driverId: string | null;
  drivers: DriverOption[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    const userId = value === '' ? null : value;
    startTransition(async () => {
      const res = await assignDriver(eventId, userId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(userId ? 'Driver assigned' : 'Driver cleared');
        router.refresh();
      }
    });
  }

  // Drivers who are no longer org members but still assigned: keep a stable label.
  const assignedKnown = driverId && drivers.some((d) => d.id === driverId);

  if (!canAssign) {
    const driver = drivers.find((d) => d.id === driverId);
    return (
      <span className="text-xs text-muted-foreground">
        {driver ? driver.name : driverId ? 'Assigned' : 'Unassigned'}
      </span>
    );
  }

  return (
    <select
      className={`${selectCls} h-8 py-0 text-xs`}
      value={driverId ?? ''}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Assign driver"
    >
      <option value="">Unassigned</option>
      {!assignedKnown && driverId ? <option value={driverId}>Former member</option> : null}
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name} ({d.role})
        </option>
      ))}
    </select>
  );
}

export function StatusSelect({
  eventId,
  status,
  canEdit,
}: {
  eventId: string;
  status: DispatchStatus;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(value: string) {
    const next = value as DispatchStatus;
    startTransition(async () => {
      const res = await setDispatchStatus(eventId, next);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Status updated');
        router.refresh();
      }
    });
  }

  if (!canEdit) return null;

  return (
    <select
      className={`${selectCls} h-8 py-0 text-xs`}
      value={status}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Update dispatch status"
    >
      {DISPATCH_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
