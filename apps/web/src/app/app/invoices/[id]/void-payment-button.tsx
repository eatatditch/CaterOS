'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { voidPayment } from '@/lib/actions/billing';

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function doVoid() {
    startTransition(async () => {
      const res = await voidPayment({ payment_id: paymentId });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Payment voided');
      setConfirming(false);
      router.refresh();
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium text-destructive hover:underline"
      >
        Void
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs whitespace-nowrap">
      <span className="text-muted-foreground">Void?</span>
      <button
        type="button"
        onClick={doVoid}
        disabled={isPending}
        className="font-medium text-destructive hover:underline disabled:opacity-60"
      >
        {isPending ? 'Voiding…' : 'Yes'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="text-muted-foreground hover:underline"
      >
        No
      </button>
    </span>
  );
}
