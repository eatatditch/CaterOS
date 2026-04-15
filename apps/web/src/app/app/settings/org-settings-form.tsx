'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateOrg } from '@/lib/actions/org';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

export function OrgSettingsForm({
  initial,
  timezones,
  canEdit,
}: {
  initial: { name: string; timezone: string; currency: string };
  timezones: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await updateOrg(fd);
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
    <form action={onSubmit} className="space-y-4">
      <Field label="Organization name" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          defaultValue={initial.name}
          disabled={!canEdit}
          className={inputCls}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Timezone" htmlFor="timezone">
          <select
            id="timezone"
            name="timezone"
            defaultValue={initial.timezone}
            disabled={!canEdit}
            className={selectCls}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency" htmlFor="currency">
          <select
            id="currency"
            name="currency"
            defaultValue={initial.currency}
            disabled={!canEdit}
            className={selectCls}
          >
            {['USD', 'CAD', 'EUR', 'GBP', 'AUD'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {canEdit ? (
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only owners and managers can update org settings.
        </p>
      )}
    </form>
  );
}
