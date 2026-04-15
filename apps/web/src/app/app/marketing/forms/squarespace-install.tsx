'use client';

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type FieldKey =
  | 'last_name'
  | 'phone'
  | 'company'
  | 'event_date'
  | 'event_time'
  | 'service_type'
  | 'location'
  | 'guest_count'
  | 'message';

type FieldDef = {
  key: FieldKey;
  label: string;
  description: string;
  defaultOn: boolean;
};

const FIELDS: FieldDef[] = [
  { key: 'last_name', label: 'Last name', description: 'Paired next to first name', defaultOn: true },
  { key: 'phone', label: 'Phone', description: 'Phone number input', defaultOn: true },
  { key: 'company', label: 'Company', description: 'For corporate inquiries', defaultOn: true },
  { key: 'event_date', label: 'Event date', description: 'Date picker', defaultOn: true },
  { key: 'event_time', label: 'Event time', description: 'Time picker', defaultOn: true },
  {
    key: 'service_type',
    label: 'Service type',
    description: 'On-premise / Off-premise toggle',
    defaultOn: true,
  },
  {
    key: 'location',
    label: 'Location to book',
    description: 'Dropdown of your kitchens/locations',
    defaultOn: true,
  },
  { key: 'guest_count', label: 'Number of guests', description: 'Integer input', defaultOn: true },
  { key: 'message', label: 'Message', description: 'Free-text notes', defaultOn: true },
];

export function SquarespaceInstall({
  appUrl,
  orgSlug,
  orgName,
}: {
  appUrl: string;
  orgSlug: string;
  orgName: string;
}) {
  const [accent, setAccent] = useState('#ea580c');
  const [buttonText, setButtonText] = useState('Request a quote');
  const [thanksText, setThanksText] = useState("Thanks! We'll be in touch shortly.");

  const [enabled, setEnabled] = useState<Record<FieldKey, boolean>>(
    FIELDS.reduce(
      (acc, f) => ({ ...acc, [f.key]: f.defaultOn }),
      {} as Record<FieldKey, boolean>,
    ),
  );
  const [required, setRequired] = useState<Record<FieldKey, boolean>>(
    FIELDS.reduce(
      (acc, f) => ({ ...acc, [f.key]: false }),
      {} as Record<FieldKey, boolean>,
    ),
  );

  const [copied, setCopied] = useState(false);

  const enabledKeys = FIELDS.filter((f) => enabled[f.key]).map((f) => f.key);
  const requiredKeys = enabledKeys.filter((k) => required[k]);

  const snippet = useMemo(() => {
    const attrs = [
      `data-cateros-form`,
      `data-org="${orgSlug}"`,
      `data-accent="${accent}"`,
      `data-button="${buttonText}"`,
      `data-thanks="${thanksText}"`,
    ];
    // Only emit data-fields when user has customized the set
    const defaultSet = FIELDS.filter((f) => f.defaultOn)
      .map((f) => f.key)
      .sort()
      .join(',');
    const currentSet = [...enabledKeys].sort().join(',');
    if (currentSet !== defaultSet) {
      attrs.push(`data-fields="${enabledKeys.join(',')}"`);
    }
    if (requiredKeys.length > 0) {
      attrs.push(`data-required="${requiredKeys.join(',')}"`);
    }

    return [
      `<!-- ${orgName} — catering request form -->`,
      `<div ${attrs.join('\n     ')}></div>`,
      `<script src="${appUrl}/widget.js" async></script>`,
    ].join('\n');
  }, [orgSlug, orgName, appUrl, accent, buttonText, thanksText, enabledKeys, requiredKeys]);

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success('Copied — paste into a Squarespace Code Block.');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg border bg-card">
      <header className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
            Squarespace
          </span>
          <h2 className="font-semibold">Plug-and-play install</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose which fields to show, customize the look, and paste the snippet into a Squarespace{' '}
          <strong>Code Block</strong>.
        </p>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
        {/* LEFT: Configuration */}
        <div className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold">Fields</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              First name and email are always included. Toggle the rest:
            </p>
            <div className="divide-y rounded-md border">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex items-center gap-3 px-3 py-2.5">
                  <input
                    type="checkbox"
                    id={`f-${f.key}`}
                    checked={enabled[f.key]}
                    onChange={(e) =>
                      setEnabled((s) => ({ ...s, [f.key]: e.target.checked }))
                    }
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                  <label htmlFor={`f-${f.key}`} className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground">{f.description}</div>
                  </label>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-1.5 text-xs',
                      !enabled[f.key] && 'opacity-40',
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={!enabled[f.key]}
                      checked={required[f.key]}
                      onChange={(e) =>
                        setRequired((s) => ({ ...s, [f.key]: e.target.checked }))
                      }
                      className="h-3.5 w-3.5 cursor-pointer accent-destructive"
                    />
                    required
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Styling</h3>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Button color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border"
                />
                <input
                  type="text"
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="flex-1 rounded-md border bg-background px-3 py-2 font-mono text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Button label
              </label>
              <input
                type="text"
                value={buttonText}
                onChange={(e) => setButtonText(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Success message
              </label>
              <input
                type="text"
                value={thanksText}
                onChange={(e) => setThanksText(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          </section>

          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">How to install:</strong>
            <ol className="mt-2 space-y-1.5 pl-4">
              <li>1. Edit your Squarespace page</li>
              <li>
                2. Add a <strong>Code Block</strong> (not Markdown)
              </li>
              <li>3. Paste the snippet on the right</li>
              <li>4. Save.</li>
            </ol>
          </div>
        </div>

        {/* RIGHT: Snippet + preview */}
        <div className="min-w-0 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">
                Snippet (copy this)
              </div>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy snippet'}
              </button>
            </div>
            <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
              <code>{snippet}</code>
            </pre>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground">Live preview</div>
            <div
              className="rounded-lg border bg-background p-5"
              style={{ ['--cx-accent' as string]: accent } as React.CSSProperties}
            >
              <PreviewForm
                accent={accent}
                buttonText={buttonText}
                enabled={enabled}
                required={required}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewForm({
  accent,
  buttonText,
  enabled,
  required,
}: {
  accent: string;
  buttonText: string;
  enabled: Record<FieldKey, boolean>;
  required: Record<FieldKey, boolean>;
}) {
  const ReqMark = () => <span className="ml-0.5 text-destructive">*</span>;
  const inputCls =
    'w-full rounded-md border bg-background px-3 py-2 text-sm disabled:bg-muted/20';
  const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground';

  return (
    <div className="space-y-3">
      <div
        className={cn('grid gap-3', enabled.last_name ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}
      >
        <div>
          <label className={labelCls}>
            First name <ReqMark />
          </label>
          <input disabled placeholder="Jane" className={inputCls} />
        </div>
        {enabled.last_name && (
          <div>
            <label className={labelCls}>
              Last name {required.last_name && <ReqMark />}
            </label>
            <input disabled placeholder="Smith" className={inputCls} />
          </div>
        )}
      </div>

      <div
        className={cn('grid gap-3', enabled.phone ? 'sm:grid-cols-2' : 'sm:grid-cols-1')}
      >
        <div>
          <label className={labelCls}>
            Email <ReqMark />
          </label>
          <input disabled placeholder="jane@example.com" className={inputCls} />
        </div>
        {enabled.phone && (
          <div>
            <label className={labelCls}>
              Phone {required.phone && <ReqMark />}
            </label>
            <input disabled placeholder="(555) 555-5555" className={inputCls} />
          </div>
        )}
      </div>

      {enabled.company && (
        <div>
          <label className={labelCls}>
            Company {required.company && <ReqMark />}
          </label>
          <input disabled placeholder="Acme Co." className={inputCls} />
        </div>
      )}

      {(enabled.event_date || enabled.event_time) && (
        <div
          className={cn(
            'grid gap-3',
            enabled.event_date && enabled.event_time ? 'sm:grid-cols-2' : 'sm:grid-cols-1',
          )}
        >
          {enabled.event_date && (
            <div>
              <label className={labelCls}>
                Event date {required.event_date && <ReqMark />}
              </label>
              <input disabled type="date" className={inputCls} />
            </div>
          )}
          {enabled.event_time && (
            <div>
              <label className={labelCls}>
                Event time {required.event_time && <ReqMark />}
              </label>
              <input disabled type="time" className={inputCls} />
            </div>
          )}
        </div>
      )}

      {enabled.service_type && (
        <div>
          <label className={labelCls}>
            Service type {required.service_type && <ReqMark />}
          </label>
          <div className="flex gap-2">
            <div
              className="flex flex-1 items-center justify-center rounded-md border px-3 py-2 text-sm font-medium text-white"
              style={{ background: accent, borderColor: accent }}
            >
              On-premise
            </div>
            <div className="flex flex-1 items-center justify-center rounded-md border bg-background px-3 py-2 text-sm font-medium">
              Off-premise
            </div>
          </div>
        </div>
      )}

      {enabled.location && (
        <div>
          <label className={labelCls}>
            Location to book {required.location && <ReqMark />}
          </label>
          <select disabled className={inputCls}>
            <option>Main Kitchen</option>
          </select>
        </div>
      )}

      {enabled.guest_count && (
        <div>
          <label className={labelCls}>
            Number of guests {required.guest_count && <ReqMark />}
          </label>
          <input disabled type="number" placeholder="50" className={inputCls} />
        </div>
      )}

      {enabled.message && (
        <div>
          <label className={labelCls}>
            Tell us about your event {required.message && <ReqMark />}
          </label>
          <textarea disabled rows={3} placeholder="Buffet, dietary notes…" className={inputCls} />
        </div>
      )}

      <button
        type="button"
        disabled
        style={{ background: accent }}
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white opacity-90"
      >
        {buttonText}
      </button>
    </div>
  );
}
