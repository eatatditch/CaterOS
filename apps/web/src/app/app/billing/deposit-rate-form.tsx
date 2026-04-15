'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { saveBillingSettings } from '@/lib/actions/billing';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

export function DepositRateForm({
  initial,
  autoChargeEnabled,
  canEdit,
}: {
  initial: number;
  autoChargeEnabled: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pct, setPct] = useState(() => Math.round(initial * 10000) / 100);
  const [autoCharge, setAutoCharge] = useState(autoChargeEnabled);
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
      const res = await saveBillingSettings({
        deposit_rate: numeric / 100,
        auto_charge_enabled: autoCharge,
      });
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
    <div className="space-y-4">
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

      <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-muted/20 p-3">
        <input
          type="checkbox"
          checked={autoCharge}
          onChange={(e) => setAutoCharge(e.target.checked)}
          disabled={!canEdit}
          className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
        />
        <div className="flex-1 text-sm">
          <div className="font-medium">Auto-charge balance 24h before event</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            When a client pays their deposit via Stripe Checkout, we save the card on
            file. One hour before this window, an hourly Vercel cron charges the
            remaining balance off-session. Clients don&apos;t need to re-enter
            anything.
          </div>
        </div>
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {canEdit ? (
        <button type="button" onClick={onSave} disabled={isSaving} className={buttonPrimaryCls}>
          {isSaving ? 'Saving…' : 'Save billing settings'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only owners and managers can change this.
        </p>
      )}
    </div>
  );
}
