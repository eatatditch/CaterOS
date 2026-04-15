'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteSequenceStep } from '@/lib/actions/marketing';

type Step = {
  id: string;
  position: number;
  delay_hours: number;
  subject: string;
  body_html: string;
};

export function StepList({ sequenceId, steps }: { sequenceId: string; steps: Step[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete(id: string) {
    if (!confirm('Remove this step?')) return;
    startTransition(async () => {
      const res = await deleteSequenceStep(id, sequenceId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Step removed');
        router.refresh();
      }
    });
  }

  if (steps.length === 0) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No steps yet. Add your first step below.
      </p>
    );
  }

  return (
    <ol className="divide-y">
      {steps.map((s, idx) => {
        const delayLabel =
          idx === 0
            ? s.delay_hours === 0
              ? 'Send immediately on trigger'
              : `Wait ${formatDelay(s.delay_hours)} after trigger`
            : `Wait ${formatDelay(s.delay_hours)} after previous step`;
        return (
          <li key={s.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {delayLabel}
              </div>
              <div className="mt-0.5 text-sm font-medium">{s.subject}</div>
              <div
                className="mt-1 line-clamp-2 text-xs text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: s.body_html }}
              />
            </div>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              disabled={isPending}
              className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete step"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function formatDelay(hours: number): string {
  if (hours === 0) return '0 hours';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
