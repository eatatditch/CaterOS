'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { sendContactEmail } from '@/lib/actions/gmail';
import {
  Field,
  inputCls,
  textareaCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

export function SendEmailForm({
  contactId,
  to,
  defaultSubject = '',
}: {
  contactId: string;
  to: string;
  defaultSubject?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(fd: FormData) {
    setError(null);
    fd.set('contact_id', contactId);
    fd.set('to', to);
    startTransition(async () => {
      const res = await sendContactEmail(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success('Email sent');
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} action={onSubmit} className="space-y-3">
      <div className="text-xs text-muted-foreground">
        To: <span className="font-medium">{to}</span>
      </div>
      <Field label="Subject" htmlFor="email-subject">
        <input
          id="email-subject"
          name="subject"
          required
          defaultValue={defaultSubject}
          placeholder="Quick question about your event"
          className={inputCls}
        />
      </Field>
      <Field label="Message" htmlFor="email-body">
        <textarea
          id="email-body"
          name="body"
          required
          rows={6}
          className={textareaCls}
          placeholder="Write your message…"
        />
      </Field>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex items-center justify-end">
        <button type="submit" disabled={isPending} className={buttonPrimaryCls}>
          <Send className="h-4 w-4" />
          {isPending ? 'Sending…' : 'Send email'}
        </button>
      </div>
    </form>
  );
}
