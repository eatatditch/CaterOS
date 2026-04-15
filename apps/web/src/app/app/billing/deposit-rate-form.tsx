'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveDepositRate } from '@/lib/actions/billing';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

export function DepositRateForm({
  initial,
  canEdit,
}: {
  initial: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pct, setPct] = useState(() => Math.round(initial * 10000) / 100);
  const [isSaving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    setError(null);
    const numeric = Number(pct);
    if (!isFinite(numeric) || numeric < 0 || numeric > 100) {
      setError('Enter a percentage between 0 and 100');
      return;
    }
    startSaving(async () => {
      const res = await saveDepositRate({ deposit_rate: numeric / 100 });
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Saved');
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <Field label="Deposit percentage" htmlFor="deposit_rate">
        <div className="flex items-center gap-2">
          <input
            id="deposit_rate"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            disabled={!canEdit}
            className={`${inputCls} max-w-[140px]`}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {canEdit ? (
        <button type="button" onClick={onSave} disabled={isSaving} className={buttonPrimaryCls}>
          {isSaving ? 'Saving…' : 'Save deposit rate'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only owners and managers can change this.
        </p>
      )}
    </div>
  );
}
