'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Trash2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@cateros/lib/money';
import { assignEventStaff, updateEventStaff, removeEventStaff } from '@/lib/actions/events';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
  buttonOutlineCls,
} from '@/components/ui/field';

type StaffMember = {
  id: string;
  userId: string | null;
  role: string;
  callTime: string | null;
  releaseTime: string | null;
  hourlyRateCents: number | null;
  currency: string;
  memberName: string | null;
};

type OrgMember = { id: string; label: string };

// HTML datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function StaffForm({
  members,
  defaultCurrency,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  members: OrgMember[];
  defaultCurrency: string;
  initial?: StaffMember;
  pending: boolean;
  onSubmit: (fd: FormData) => void;
  onCancel?: () => void;
}) {
  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Team member" htmlFor="user_id">
        <select
          id="user_id"
          name="user_id"
          defaultValue={initial?.userId ?? ''}
          className={selectCls}
        >
          <option value="">— Unassigned —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Role" htmlFor="role">
        <input
          id="role"
          name="role"
          required
          defaultValue={initial?.role ?? ''}
          placeholder="Captain, Server, Chef, Driver…"
          className={inputCls}
        />
      </Field>
      <Field label="Call time" htmlFor="call_time">
        <input
          id="call_time"
          name="call_time"
          type="datetime-local"
          defaultValue={toLocalInput(initial?.callTime ?? null)}
          className={inputCls}
        />
      </Field>
      <Field label="Release time" htmlFor="release_time">
        <input
          id="release_time"
          name="release_time"
          type="datetime-local"
          defaultValue={toLocalInput(initial?.releaseTime ?? null)}
          className={inputCls}
        />
      </Field>
      <Field
        label={`Hourly rate (${defaultCurrency})`}
        htmlFor="hourly_rate"
        hint="Entered in dollars; stored as cents."
      >
        <input
          id="hourly_rate"
          name="hourly_rate"
          type="number"
          min="0"
          step="0.01"
          defaultValue={
            initial?.hourlyRateCents != null ? (initial.hourlyRateCents / 100).toFixed(2) : ''
          }
          placeholder="25.00"
          className={inputCls}
        />
      </Field>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending} className={buttonPrimaryCls}>
          {pending ? 'Saving…' : initial ? 'Save' : 'Assign'}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonOutlineCls}>
            <X className="h-4 w-4" /> Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function StaffingSection({
  eventId,
  staff,
  members,
  defaultCurrency,
  canManage,
}: {
  eventId: string;
  staff: StaffMember[];
  members: OrgMember[];
  defaultCurrency: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function onAssign(fd: FormData) {
    startTransition(async () => {
      const res = await assignEventStaff(eventId, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Staff assigned');
        setAdding(false);
        router.refresh();
      }
    });
  }

  function onUpdate(staffId: string, fd: FormData) {
    startTransition(async () => {
      const res = await updateEventStaff(staffId, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Assignment updated');
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function onRemove(staffId: string) {
    if (!confirm('Remove this staff assignment?')) return;
    startTransition(async () => {
      const res = await removeEventStaff(staffId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Assignment removed');
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Staffing ({staff.length})</h2>
        </div>
        {canManage && !adding ? (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setEditingId(null);
            }}
            disabled={isPending}
            className={buttonOutlineCls + ' h-8 text-xs'}
          >
            <Plus className="h-3.5 w-3.5" /> Assign staff
          </button>
        ) : null}
      </header>

      <div className="p-6">
        {adding ? (
          <div className="mb-6 rounded-md border bg-muted/30 p-4">
            <StaffForm
              members={members}
              defaultCurrency={defaultCurrency}
              pending={isPending}
              onSubmit={onAssign}
              onCancel={() => setAdding(false)}
            />
          </div>
        ) : null}

        {staff.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No staff assigned yet.
            {canManage ? ' Use “Assign staff” to add team members.' : ''}
          </p>
        ) : (
          <ul className="divide-y">
            {staff.map((s) =>
              editingId === s.id ? (
                <li key={s.id} className="py-4">
                  <StaffForm
                    members={members}
                    defaultCurrency={defaultCurrency}
                    initial={s}
                    pending={isPending}
                    onSubmit={(fd) => onUpdate(s.id, fd)}
                    onCancel={() => setEditingId(null)}
                  />
                </li>
              ) : (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>{s.memberName ?? 'Unassigned'}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal capitalize text-muted-foreground">
                        {s.role}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Call {fmtTime(s.callTime)}
                      {s.releaseTime ? ` · Release ${fmtTime(s.releaseTime)}` : ''}
                      {s.hourlyRateCents != null
                        ? ` · ${formatMoney(s.hourlyRateCents, s.currency)}/hr`
                        : ''}
                    </div>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(s.id);
                          setAdding(false);
                        }}
                        disabled={isPending}
                        className={buttonOutlineCls + ' h-8 text-xs'}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemove(s.id)}
                        disabled={isPending}
                        className={buttonOutlineCls + ' h-8 text-xs text-destructive'}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
