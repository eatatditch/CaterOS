'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteDeal } from '@/lib/actions/deals';
import { buttonPrimaryCls, buttonDestructiveCls } from '@/components/ui/field';

export function DealHeaderActions({
  dealId,
  dealTitle,
}: {
  dealId: string;
  dealTitle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    const confirmed = confirm(
      `Remove "${dealTitle}" from the pipeline? Activities linked to this deal are also removed. Quotes are kept (with the deal link cleared).`,
    );
    if (!confirmed) return;
    startTransition(async () => {
      const res = await deleteDeal(dealId);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success('Deal removed');
        router.push('/app/pipeline');
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/app/quotes/new?deal=${dealId}`} className={buttonPrimaryCls}>
        Create quote from this
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className={buttonDestructiveCls}
        title="Remove deal from pipeline"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? 'Removing…' : 'Remove'}
      </button>
    </div>
  );
}
