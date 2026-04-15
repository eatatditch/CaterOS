'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export function EmbedSnippet({ endpoint, orgName }: { endpoint: string; orgName: string }) {
  const [copied, setCopied] = useState<'html' | 'react' | null>(null);

  const html = `<!-- ${orgName} catering request form -->
<form id="cateros-form" onsubmit="event.preventDefault();(async()=>{const fd=new FormData(this);const r=await fetch('${endpoint}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fd))});if(r.ok){this.reset();document.getElementById('cateros-ok').hidden=false;}else{document.getElementById('cateros-err').hidden=false;}})()" style="display:grid;gap:12px;max-width:560px;font-family:system-ui">
  <input style="display:none" name="website" autocomplete="off" tabindex="-1" />
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <input required name="first_name" placeholder="First name" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
    <input name="last_name" placeholder="Last name" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
  </div>
  <input required type="email" name="email" placeholder="Email" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
  <input name="phone" type="tel" placeholder="Phone" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
  <input name="company" placeholder="Company" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <input name="event_date" type="date" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
    <input name="headcount" type="number" min="0" placeholder="Head count" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px" />
  </div>
  <textarea name="message" rows="4" placeholder="Tell us about your event" style="padding:10px;border:1px solid #d4d4d8;border-radius:6px"></textarea>
  <button type="submit" style="background:#ea580c;color:white;padding:12px;border:none;border-radius:6px;font-weight:600;cursor:pointer">Request a quote</button>
  <div id="cateros-ok" hidden style="color:#15803d">Thanks! We'll be in touch shortly.</div>
  <div id="cateros-err" hidden style="color:#b91c1c">Something went wrong. Please try again.</div>
</form>`;

  const react = `// React + fetch — drop on any client component
async function submit(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const res = await fetch('${endpoint}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(fd)),
  });
  if (res.ok) { /* show success */ }
}`;

  async function copy(text: string, which: 'html' | 'react') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    toast.success('Copied!');
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="font-semibold">HTML embed snippet</h3>
            <p className="text-xs text-muted-foreground">
              Paste into your website. No JS dependencies. Includes a honeypot for spam.
            </p>
          </div>
          <button
            onClick={() => copy(html, 'html')}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            {copied === 'html' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'html' ? 'Copied' : 'Copy'}
          </button>
        </header>
        <pre className="max-h-96 overflow-auto bg-muted/40 p-4 text-xs leading-relaxed">
          <code>{html}</code>
        </pre>
      </div>

      <div className="rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="font-semibold">React / fetch example</h3>
            <p className="text-xs text-muted-foreground">
              For custom form UIs — just POST the JSON body to your endpoint.
            </p>
          </div>
          <button
            onClick={() => copy(react, 'react')}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            {copied === 'react' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === 'react' ? 'Copied' : 'Copy'}
          </button>
        </header>
        <pre className="bg-muted/40 p-4 text-xs leading-relaxed">
          <code>{react}</code>
        </pre>
      </div>
    </div>
  );
}
