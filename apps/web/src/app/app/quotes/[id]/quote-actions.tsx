'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { setQuoteStatus } from '@/lib/actions/quotes';
import { buttonOutlineCls } from '@/components/ui/field';

export function QuoteActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function transition(next: 'sent' | 'accepted' | 'declined' | 'draft') {
    startTransition(async () => {
      const res = await setQuoteStatus(id, next);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`Marked ${next}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'draft' && (
        <button
          disabled={isPending}
          onClick={() => transition('sent')}
          className={buttonOutlineCls}
        >
          Mark sent
        </button>
      )}
      {(status === 'sent' || status === 'viewed') && (
        <>
          <button
            disabled={isPending}
            onClick={() => transition('accepted')}
            className={buttonOutlineCls}
          >
            Mark accepted
          </button>
          <button
            disabled={isPending}
            onClick={() => transition('declined')}
            className={buttonOutlineCls}
          >
            Mark declined
          </button>
        </>
      )}
    </div>
  );
}
