'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { upsertGoal } from '@/lib/actions/goals';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

export function GoalForm({
  managers,
  locations,
}: {
  managers: { id: string; name: string; role: string }[];
  locations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await upsertGoal(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Goal saved');
        router.refresh();
      }
    });
  }

  // Default period_start to start of current week (Monday).
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const defaultStart = monday.toISOString().slice(0, 10);

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Manager" htmlFor="owner_id">
          <select id="owner_id" name="owner_id" defaultValue="" className={selectCls}>
            <option value="">All managers (cross-team)</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.role}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location" htmlFor="location_id">
          <select id="location_id" name="location_id" defaultValue="" className={selectCls}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Period" htmlFor="period_type">
          <select
            id="period_type"
            name="period_type"
            defaultValue="monthly"
            className={selectCls}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </Field>
        <Field label="Period start" htmlFor="period_start">
          <input
            id="period_start"
            name="period_start"
            type="date"
            defaultValue={defaultStart}
            required
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Revenue goal ($)" htmlFor="revenue_goal">
        <input
          id="revenue_goal"
          name="revenue_goal"
          type="number"
          step="100"
          min="0"
          defaultValue="0"
          className={inputCls}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Outbound contacts" htmlFor="outbound_contacts">
          <input
            id="outbound_contacts"
            name="outbound_contacts"
            type="number"
            min="0"
            defaultValue="0"
            className={inputCls}
          />
        </Field>
        <Field label="Tastings booked" htmlFor="tastings">
          <input
            id="tastings"
            name="tastings"
            type="number"
            min="0"
            defaultValue="0"
            className={inputCls}
          />
        </Field>
        <Field label="Prospects contacted" htmlFor="prospects_contacted">
          <input
            id="prospects_contacted"
            name="prospects_contacted"
            type="number"
            min="0"
            defaultValue="0"
            className={inputCls}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes">
        <textarea id="notes" name="notes" rows={2} className={inputCls} />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
        {isPending ? 'Saving…' : 'Save goal'}
      </button>
    </form>
  );
}
