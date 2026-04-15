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
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map((stage) => {
        const columnDeals = deals.filter((d) => d.stage_id === stage.id);
        const total = columnDeals.reduce((s, d) => s + d.amount_cents, 0);
        const tone = stage.is_won
          ? 'text-green-600'
          : stage.is_lost
            ? 'text-red-600'
            : 'text-muted-foreground';
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
              'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors',
              hoverStage === stage.id && 'border-primary bg-primary/5',
            )}
          >
            <div className="flex items-center justify-between border-b bg-card px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{stage.name}</div>
                <div className={cn('text-xs', tone)}>
                  {columnDeals.length} · {formatMoney(total, columnDeals[0]?.currency ?? 'USD')}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{stage.probability}%</span>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {columnDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/app/deals/${d.id}`}
                  draggable
                  onDragStart={() => setDraggingId(d.id)}
                  onDragEnd={() => setDraggingId(null)}
                  className={cn(
                    'block rounded-md border bg-card p-3 text-sm shadow-sm transition-shadow hover:shadow',
                    draggingId === d.id && 'opacity-50',
                  )}
                >
                  <div className="mb-1 font-medium">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.company_name ?? d.contact_name ?? 'No contact'}
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {formatMoney(d.amount_cents, d.currency)}
                  </div>
                </Link>
              ))}
              {!columnDeals.length && (
                <div className="py-6 text-center text-xs text-muted-foreground">Drag deals here</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
