'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createSegment } from '@/lib/actions/marketing';
import {
  Field,
  inputCls,
  selectCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

const LIFECYCLE_OPTIONS = [
  'subscriber',
  'lead',
  'mql',
  'sql',
  'opportunity',
  'customer',
  'evangelist',
  'other',
];

export function NewSegmentForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lifecycleStages, setLifecycleStages] = useState<string[]>([]);
  const [tags, setTags] = useState('');
  const [leadSources, setLeadSources] = useState('');
  const [createdAfter, setCreatedAfter] = useState('');

  function toggleStage(stage: string) {
    setLifecycleStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  }

  function onSubmit(fd: FormData) {
    setError(null);
    const filters: Record<string, unknown> = {};
    if (lifecycleStages.length > 0) filters.lifecycle_stage = lifecycleStages;
    if (tags.trim())
      filters.tags_any = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    if (leadSources.trim())
      filters.lead_source = leadSources
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    if (createdAfter) filters.created_after = createdAfter;
    fd.set('filters', JSON.stringify(filters));

    startTransition(async () => {
      const res = await createSegment(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label="Name" htmlFor="name">
        <input id="name" name="name" required placeholder="High-value leads" className={inputCls} />
      </Field>

      <Field label="Description" htmlFor="description">
        <textarea id="description" name="description" rows={2} className={textareaCls} />
      </Field>

      <Field label="Kind" htmlFor="kind">
        <select id="kind" name="kind" defaultValue="dynamic" className={selectCls}>
          <option value="dynamic">Dynamic (auto-updated from filters)</option>
          <option value="manual">Manual (contacts you add one-by-one)</option>
        </select>
      </Field>

      <div className="rounded-md border bg-muted/20 p-4">
        <div className="mb-3 text-sm font-semibold">Filters (dynamic segments)</div>

        <div className="mb-4">
          <label className="mb-2 block text-xs font-medium text-muted-foreground">
            Lifecycle stages
          </label>
          <div className="flex flex-wrap gap-2">
            {LIFECYCLE_OPTIONS.map((stage) => {
              const active = lifecycleStages.includes(stage);
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => toggleStage(stage)}
                  className={`rounded-full border px-3 py-1 text-xs capitalize ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground hover:bg-accent'}`}
                >
                  {stage.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>

        <Field label="Tags (comma-separated)" htmlFor="tags">
          <input
            id="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="vip, corporate"
            className={inputCls}
          />
        </Field>

        <Field label="Lead sources (comma-separated)" htmlFor="leadSources">
          <input
            id="leadSources"
            value={leadSources}
            onChange={(e) => setLeadSources(e.target.value)}
            placeholder="eatatditch.com, referral"
            className={inputCls}
          />
        </Field>

        <Field label="Created after" htmlFor="createdAfter">
          <input
            id="createdAfter"
            type="date"
            value={createdAfter}
            onChange={(e) => setCreatedAfter(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
        {isPending ? 'Creating…' : 'Create segment'}
      </button>
    </form>
  );
}
