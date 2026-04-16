'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Lock, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { createBeo, updateBeo, finalizeBeo, deleteBeo } from '@/lib/actions/beos';
import {
  Field,
  inputCls,
  textareaCls,
  buttonPrimaryCls,
  buttonOutlineCls,
  buttonDestructiveCls,
} from '@/components/ui/field';
import { StatusBadge } from '@/components/ui/status-badge';

type Beo = {
  id: string;
  version: number;
  title: string | null;
  status: string;
  notes: string | null;
  content: Record<string, string>;
  generated_at: string;
  finalized_at: string | null;
};

const SECTIONS: { key: string; label: string; placeholder: string }[] = [
  {
    key: 'timeline',
    label: 'Timeline / Run-of-show',
    placeholder: '4:00 PM — Team arrives / setup\n5:00 PM — Guests arrive\n5:30 PM — Buffet opens\n7:00 PM — Breakdown begins',
  },
  {
    key: 'kitchen_notes',
    label: 'Kitchen notes',
    placeholder: 'Prep instructions, cook temps, plating notes…',
  },
  {
    key: 'service_notes',
    label: 'Service / front-of-house notes',
    placeholder: 'Service style details, pass-around instructions, bar setup…',
  },
  {
    key: 'setup_instructions',
    label: 'Setup instructions',
    placeholder: 'Table layout, linen colors, chafing dish count, signage…',
  },
  {
    key: 'equipment',
    label: 'Equipment & rentals',
    placeholder: '10× chafing dishes, 2× 6-ft tables, 200 plates, sternos…',
  },
  {
    key: 'staffing_notes',
    label: 'Staffing',
    placeholder: '2 servers, 1 chef, 1 lead — call time 3:30 PM',
  },
  {
    key: 'dietary_allergens',
    label: 'Dietary & allergens',
    placeholder: 'Table 4: 2 vegetarian, 1 gluten-free. No peanut products.',
  },
  {
    key: 'special_requests',
    label: 'Special requests',
    placeholder: 'Client wants dessert served at 6:30 sharp, candles on cake…',
  },
];

export function BeoSection({
  eventId,
  beos,
  menuItems,
}: {
  eventId: string;
  beos: Beo[];
  menuItems: { name: string; quantity: number }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(beos[0]?.id ?? null);

  const activeBeo = beos.find((b) => b.id === activeId) ?? null;
  const isDraft = activeBeo?.status === 'draft';

  function onCreateNew() {
    startTransition(async () => {
      const res = await createBeo(eventId);
      if (res?.error) toast.error(res.error);
      else if (res.beoId) {
        toast.success('New BEO version created');
        setActiveId(res.beoId);
        router.refresh();
      }
    });
  }

  function onSave(fd: FormData) {
    if (!activeBeo) return;
    startTransition(async () => {
      const res = await updateBeo(activeBeo.id, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('BEO saved');
        router.refresh();
      }
    });
  }

  function onFinalize() {
    if (!activeBeo) return;
    if (!confirm('Finalize this BEO? It will be locked from editing. You can create a new revision.'))
      return;
    startTransition(async () => {
      const res = await finalizeBeo(activeBeo.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('BEO finalized');
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!activeBeo) return;
    if (!confirm('Delete this BEO version?')) return;
    startTransition(async () => {
      const res = await deleteBeo(activeBeo.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('BEO deleted');
        setActiveId(beos.find((b) => b.id !== activeBeo.id)?.id ?? null);
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Banquet Event Order</h2>
        </div>
        <div className="flex items-center gap-2">
          {beos.length > 0 ? (
            <select
              value={activeId ?? ''}
              onChange={(e) => setActiveId(e.target.value)}
              className={`${inputCls} h-8 w-48 text-xs`}
            >
              {beos.map((b) => (
                <option key={b.id} value={b.id}>
                  v{b.version} {b.status === 'final' ? '(final)' : '(draft)'}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            onClick={onCreateNew}
            disabled={isPending}
            className={buttonOutlineCls + ' h-8 text-xs'}
          >
            <Plus className="h-3.5 w-3.5" /> {beos.length === 0 ? 'Create BEO' : 'New revision'}
          </button>
        </div>
      </header>

      {activeBeo ? (
        <div className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <StatusBadge
              label={activeBeo.status}
              tone={activeBeo.status === 'final' ? 'green' : 'yellow'}
            />
            {activeBeo.finalized_at ? (
              <span className="text-xs text-muted-foreground">
                Finalized{' '}
                {new Date(activeBeo.finalized_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            ) : null}
          </div>

          {menuItems.length > 0 ? (
            <div className="mb-6 rounded-md bg-muted/30 p-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Menu (from quote)
              </div>
              <ul className="space-y-1 text-sm">
                {menuItems.map((item, i) => (
                  <li key={i}>
                    {item.quantity}× {item.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <form action={onSave} className="space-y-4">
            <Field label="BEO title" htmlFor="title">
              <input
                id="title"
                name="title"
                defaultValue={activeBeo.title ?? ''}
                disabled={!isDraft}
                className={inputCls}
              />
            </Field>

            {SECTIONS.map((s) => (
              <Field key={s.key} label={s.label} htmlFor={s.key}>
                <textarea
                  id={s.key}
                  name={s.key}
                  rows={3}
                  defaultValue={activeBeo.content[s.key] ?? ''}
                  disabled={!isDraft}
                  placeholder={s.placeholder}
                  className={textareaCls}
                />
              </Field>
            ))}

            <Field label="Internal notes" htmlFor="notes">
              <textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={activeBeo.notes ?? ''}
                disabled={!isDraft}
                placeholder="Private notes (not shown on print view)"
                className={textareaCls}
              />
            </Field>

            {isDraft ? (
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
                  {isPending ? 'Saving…' : 'Save BEO'}
                </button>
                <button
                  type="button"
                  onClick={onFinalize}
                  disabled={isPending}
                  className={buttonOutlineCls}
                >
                  <Lock className="h-4 w-4" /> Finalize
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={isPending}
                  className={buttonDestructiveCls}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            ) : (
              <p className="pt-2 text-xs text-muted-foreground">
                This BEO is finalized. Create a new revision to make changes.
              </p>
            )}
          </form>
        </div>
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No BEO yet for this event. Click &quot;Create BEO&quot; to start building one.
        </div>
      )}
    </section>
  );
}
