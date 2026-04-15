'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pause, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteSequence, setSequenceStatus } from '@/lib/actions/marketing';
import { buttonPrimaryCls, buttonOutlineCls, buttonDestructiveCls } from '@/components/ui/field';

export function SequenceActions({
  id,
  status,
  stepCount,
}: {
  id: string;
  status: string;
  stepCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function setStatus(next: 'active' | 'paused' | 'draft') {
    if (next === 'active' && stepCount === 0) {
      toast.error('Add at least one step before activating.');
      return;
    }
    startTransition(async () => {
      const res = await setSequenceStatus(id, next);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(next === 'active' ? 'Sequence activated' : `Marked ${next}`);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!confirm('Delete this sequence? Active enrollments will stop.')) return;
    startTransition(async () => {
      const res = await deleteSequence(id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.push('/app/marketing/sequences');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status !== 'active' ? (
        <button
          type="button"
          onClick={() => setStatus('active')}
          disabled={isPending}
          className={buttonPrimaryCls}
        >
          <Play className="h-4 w-4" />
          Activate
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setStatus('paused')}
          disabled={isPending}
          className={buttonOutlineCls}
        >
          <Pause className="h-4 w-4" />
          Pause
        </button>
      )}
      <button
        type="button"
        onClick={onDelete}
        disabled={isPending}
        className={buttonDestructiveCls}
      >
        <Trash2 className="h-4 w-4" />
        Delete
      </button>
    </div>
  );
}
