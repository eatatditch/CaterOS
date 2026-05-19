'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { deleteAdSpend } from '@/lib/actions/ad-spend';

type AdSpendRow = {
  id: string;
  channel: string;
  campaign_name: string | null;
  location_id: string | null;
  spend_cents: number;
  period_start: string;
  period_end: string;
};

export function AdSpendList({
  rows,
  locations,
  currency,
}: {
  rows: AdSpendRow[];
  locations: { id: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove(id: string) {
    if (!confirm('Delete this entry?')) return;
    startTransition(async () => {
      const res = await deleteAdSpend(id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.refresh();
      }
    });
  }

  if (rows.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">No entries yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Channel</th>
            <th className="px-4 py-2 text-left font-medium">Campaign</th>
            <th className="px-4 py-2 text-left font-medium">Location</th>
            <th className="px-4 py-2 text-left font-medium">Period</th>
            <th className="px-4 py-2 text-right font-medium">Spend</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const loc = r.location_id ? locations.find((l) => l.id === r.location_id) : null;
            return (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium capitalize">{r.channel}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.campaign_name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{loc?.name ?? 'all'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.period_start} → {r.period_end}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatMoney(r.spend_cents, currency)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => remove(r.id)}
                    disabled={isPending}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
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
