'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { deleteGoal } from '@/lib/actions/goals';

type Goal = {
  id: string;
  owner_id: string | null;
  location_id: string | null;
  period_type: string;
  period_start: string;
  revenue_goal_cents: number;
  activity_goals: Record<string, number>;
  notes: string | null;
};

export function GoalsList({
  goals,
  managers,
  locations,
  currency,
}: {
  goals: Goal[];
  managers: { id: string; name: string }[];
  locations: { id: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm('Delete this goal?')) return;
    startTransition(async () => {
      const res = await deleteGoal(id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.refresh();
      }
    });
  }

  if (goals.length === 0) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        No goals set yet. Use the form above to create your first weekly or monthly goal.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Scope</th>
            <th className="px-4 py-2 text-left font-medium">Period</th>
            <th className="px-4 py-2 text-right font-medium">Revenue</th>
            <th className="px-4 py-2 text-right font-medium">Outbound</th>
            <th className="px-4 py-2 text-right font-medium">Tastings</th>
            <th className="px-4 py-2 text-right font-medium">Prospects</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {goals.map((g) => {
            const m = g.owner_id ? managers.find((x) => x.id === g.owner_id) : null;
            const l = g.location_id ? locations.find((x) => x.id === g.location_id) : null;
            return (
              <tr key={g.id}>
                <td className="px-4 py-3">
                  <div className="font-medium">{m?.name ?? 'All managers'}</div>
                  <div className="text-xs text-muted-foreground">{l?.name ?? 'All locations'}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <div className="capitalize">{g.period_type}</div>
                  <div className="text-xs">starts {g.period_start}</div>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(g.revenue_goal_cents, currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  {g.activity_goals?.outbound_contacts ?? 0}
                </td>
                <td className="px-4 py-3 text-right">{g.activity_goals?.tastings ?? 0}</td>
                <td className="px-4 py-3 text-right">
                  {g.activity_goals?.prospects_contacted ?? 0}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(g.id)}
                    disabled={isPending}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
