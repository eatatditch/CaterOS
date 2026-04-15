'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { formatMoney } from '@cateros/lib/money';
import { updateDealStage } from '@/lib/actions/deals';
import { cn } from '@/lib/utils';

type Stage = {
  id: string;
  name: string;
  position: number;
  probability: number;
  is_won: boolean;
  is_lost: boolean;
};

type Deal = {
  id: string;
  title: string;
  stage_id: string;
  amount_cents: number;
  currency: string;
  expected_close_date: string | null;
  contact_name: string | null;
  company_name: string | null;
};

export function PipelineBoard({ stages, deals }: { stages: Stage[]; deals: Deal[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<string | null>(null);

  function onDrop(stageId: string) {
    if (!draggingId) return;
    const deal = deals.find((d) => d.id === draggingId);
    setDraggingId(null);
    setHoverStage(null);
    if (!deal || deal.stage_id === stageId) return;
    startTransition(async () => {
      const res = await updateDealStage(deal.id, stageId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Deal moved');
        router.refresh();
      }
    });
  }

  return (
    <div
      className="grid min-h-[480px] gap-3"
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((stage) => {
        const columnDeals = deals.filter((d) => d.stage_id === stage.id);
        const total = columnDeals.reduce((s, d) => s + d.amount_cents, 0);
        const toneBorder = stage.is_won
          ? 'border-t-green-500'
          : stage.is_lost
            ? 'border-t-red-500'
            : 'border-t-primary/60';
        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setHoverStage(stage.id);
            }}
            onDragLeave={() => setHoverStage((s) => (s === stage.id ? null : s))}
            onDrop={() => onDrop(stage.id)}
            className={cn(
              'flex min-w-0 flex-col rounded-lg border border-t-2 bg-muted/30 transition-colors',
              toneBorder,
              hoverStage === stage.id && 'bg-primary/5 ring-2 ring-primary/40',
            )}
          >
            <div className="flex items-center justify-between border-b bg-card px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{stage.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {columnDeals.length} · {formatMoney(total, columnDeals[0]?.currency ?? 'USD')}
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                {stage.probability}%
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {columnDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/app/deals/${d.id}`}
                  draggable
                  onDragStart={() => setDraggingId(d.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={cn(
                    'block rounded-md border bg-card p-2.5 text-sm shadow-sm transition-shadow hover:shadow',
                    draggingId === d.id && 'opacity-50',
                  )}
                >
                  <div className="mb-1 line-clamp-2 text-sm font-medium leading-tight">{d.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {d.company_name ?? d.contact_name ?? 'No contact'}
                  </div>
                  <div className="mt-1.5 text-sm font-semibold">
                    {formatMoney(d.amount_cents, d.currency)}
                  </div>
                </Link>
              ))}
              {!columnDeals.length && (
                <div className="py-6 text-center text-[11px] text-muted-foreground">
                  Drop here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
