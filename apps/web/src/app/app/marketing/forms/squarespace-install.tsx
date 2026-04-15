'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

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
  const [copied, setCopied] = useState(false);

  const snippet = [
    `<!-- ${orgName} — catering request form -->`,
    `<div data-cateros-form data-org="${orgSlug}"`,
    `     data-accent="${accent}"`,
    `     data-button="${buttonText}"`,
    `     data-thanks="${thanksText}"></div>`,
    `<script src="${appUrl}/widget.js" async></script>`,
  ].join('\n');

  async function copy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success('Copied — paste into your Squarespace Code Block.');
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
          Paste this into a Squarespace <strong>Code Block</strong>. Customize the color and copy
          below — the snippet updates live.
        </p>
      </header>

      <div className="grid gap-6 p-6 md:grid-cols-[260px_1fr]">
        <div className="space-y-4">
          <div>
            <label htmlFor="accent" className="mb-1 block text-xs font-medium text-muted-foreground">
              Button color
            </label>
            <div className="flex items-center gap-2">
              <input
                id="accent"
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded border"
              />
              <input
                type="text"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="btn" className="mb-1 block text-xs font-medium text-muted-foreground">
              Button label
            </label>
            <input
              id="btn"
              type="text"
              value={buttonText}
              onChange={(e) => setButtonText(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="thx" className="mb-1 block text-xs font-medium text-muted-foreground">
              Success message
            </label>
            <input
              id="thx"
              type="text"
              value={thanksText}
              onChange={(e) => setThanksText(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">How to install:</strong>
            <ol className="mt-2 space-y-1.5 pl-4">
              <li>1. In Squarespace, edit your page</li>
              <li>
                2. Add a <strong>Code Block</strong> (not Markdown)
              </li>
              <li>3. Paste the snippet on the right</li>
              <li>4. Save — done.</li>
            </ol>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground">Snippet (copy this)</div>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy snippet'}
            </button>
          </div>
          <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
            <code>{snippet}</code>
          </pre>

          <div className="mt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">Live preview</div>
            <div className="rounded-lg border bg-background p-4">
              <PreviewForm
                accent={accent}
                buttonText={buttonText}
                thanksText={thanksText}
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
  thanksText,
}: {
  accent: string;
  buttonText: string;
  thanksText: string;
}) {
  return (
    <div
      style={{ ['--cx-accent' as string]: accent } as React.CSSProperties}
      className="[&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:bg-background [&_input]:px-3 [&_input]:py-2 [&_input]:text-sm [&_label]:mb-1 [&_label]:block [&_label]:text-xs [&_label]:font-medium [&_label]:text-muted-foreground [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:bg-background [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-sm"
    >
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label>First name</label>
          <input disabled placeholder="Jane" />
        </div>
        <div>
          <label>Last name</label>
          <input disabled placeholder="Smith" />
        </div>
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label>Email</label>
          <input disabled placeholder="jane@example.com" />
        </div>
        <div>
          <label>Phone</label>
          <input disabled placeholder="(555) 555-5555" />
        </div>
      </div>
      <div className="mb-3">
        <label>Tell us about your event</label>
        <textarea disabled rows={2} placeholder="50 people, buffet style…" />
      </div>
      <button
        type="button"
        disabled
        style={{ background: accent }}
        className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white opacity-90"
      >
        {buttonText}
      </button>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">{thanksText}</p>
    </div>
  );
}
