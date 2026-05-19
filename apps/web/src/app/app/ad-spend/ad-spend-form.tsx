'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createAdSpend } from '@/lib/actions/ad-spend';
import { Field, inputCls, selectCls, buttonPrimaryCls } from '@/components/ui/field';

export function AdSpendForm({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createAdSpend(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Saved');
        router.refresh();
      }
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Channel" htmlFor="channel">
          <select id="channel" name="channel" defaultValue="meta" required className={selectCls}>
            <option value="meta">Meta</option>
            <option value="google">Google</option>
            <option value="other">Other</option>
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

      <Field label="Campaign name (optional)" htmlFor="campaign_name">
        <input id="campaign_name" name="campaign_name" className={inputCls} />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Spend ($)" htmlFor="spend">
          <input
            id="spend"
            name="spend"
            type="number"
            step="0.01"
            min="0"
            required
            className={inputCls}
          />
        </Field>
        <Field label="Period start" htmlFor="period_start">
          <input
            id="period_start"
            name="period_start"
            type="date"
            defaultValue={today}
            required
            className={inputCls}
          />
        </Field>
        <Field label="Period end" htmlFor="period_end">
          <input
            id="period_end"
            name="period_end"
            type="date"
            defaultValue={today}
            required
            className={inputCls}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
        {isPending ? 'Saving…' : 'Add spend'}
      </button>
    </form>
  );
}
