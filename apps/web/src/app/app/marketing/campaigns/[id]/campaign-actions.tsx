'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteCampaign, sendCampaignNow } from '@/lib/actions/marketing';
import { buttonPrimaryCls, buttonDestructiveCls } from '@/components/ui/field';

export function CampaignActions({
  campaignId,
  status,
  recipientCount,
}: {
  campaignId: string;
  status: string;
  recipientCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onSend() {
    if (recipientCount === 0) {
      toast.error('No recipients. Adjust the segment.');
      return;
    }
    if (!confirm(`Send this campaign to ${recipientCount} recipient(s)? This can't be undone.`))
      return;
    startTransition(async () => {
      const res = await sendCampaignNow(campaignId);
      if (res && 'error' in res && res.error) {
        toast.error(res.error);
      } else if (res && 'sent' in res) {
        toast.success(`Sent to ${res.sent}${res.skipped ? ` (${res.skipped} failed)` : ''}`);
        router.refresh();
      }
    });
  }

  function onDelete() {
    if (!confirm('Delete this campaign?')) return;
    startTransition(async () => {
      const res = await deleteCampaign(campaignId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.push('/app/marketing/campaigns');
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status !== 'sent' && status !== 'sending' ? (
        <button
          type="button"
          onClick={onSend}
          disabled={isPending}
          className={buttonPrimaryCls}
        >
          <Send className="h-4 w-4" />
          {isPending ? 'Sending…' : 'Send now'}
        </button>
      ) : null}
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
