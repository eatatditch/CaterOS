'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addSequenceStep } from '@/lib/actions/marketing';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';
import { RichEditor } from '@/components/email/rich-editor';

export function AddStepForm({
  sequenceId,
  nextPosition,
}: {
  sequenceId: string;
  nextPosition: number;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
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
      const res = await addSequenceStep(sequenceId, fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Step added');
        formRef.current?.reset();
        setHtml('');
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field
          label={nextPosition === 0 ? 'Delay after trigger' : 'Delay after previous'}
          htmlFor="delay_hours"
          hint="Hours"
        >
          <input
            id="delay_hours"
            name="delay_hours"
            type="number"
            min="0"
            max="8760"
            defaultValue={nextPosition === 0 ? 0 : 72}
            className={inputCls}
          />
        </Field>
        <Field label="Subject" htmlFor="subject">
          <input id="subject" name="subject" required className={inputCls} />
        </Field>
      </div>

      <Field label="Body" htmlFor="body">
        <RichEditor
          value={html}
          onChange={(h) => setHtml(h)}
          placeholder="Hi {{first_name}}, just following up…"
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
        {isPending ? 'Adding…' : 'Add step'}
      </button>
    </form>
  );
}
