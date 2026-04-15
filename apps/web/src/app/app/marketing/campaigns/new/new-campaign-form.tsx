'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createCampaign } from '@/lib/actions/marketing';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
} from '@/components/ui/field';
import { RichEditor } from '@/components/email/rich-editor';

export function NewCampaignForm({ segments }: { segments: { id: string; name: string }[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState('');

  function onSubmit(fd: FormData) {
    setError(null);
    if (!html.trim()) {
      setError('Message body required');
      return;
    }
    fd.set('body_html', html);
    startTransition(async () => {
      const res = await createCampaign(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <Field label="Name (internal)" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          placeholder="Holiday promo 2026"
          className={inputCls}
        />
      </Field>

      <Field label="Subject line" htmlFor="subject">
        <input
          id="subject"
          name="subject"
          required
          placeholder="Book your holiday party by Nov 1 — save 10%"
          className={inputCls}
        />
      </Field>

      <Field label="Segment" htmlFor="segment_id" hint="Leave blank to send to every contact with an email.">
        <select id="segment_id" name="segment_id" className={selectCls} defaultValue="">
          <option value="">— All contacts —</option>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Message body" htmlFor="body">
        <RichEditor
          value={html}
          onChange={(nextHtml) => setHtml(nextHtml)}
          placeholder="Hi {{first_name}}, …"
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
        {isPending ? 'Creating…' : 'Create draft'}
      </button>
    </form>
  );
}
