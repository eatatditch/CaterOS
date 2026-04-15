'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { revokeInvitation } from '@/lib/actions/team';

export function InvitationRow({
  invitation,
  canManage,
}: {
  invitation: { id: string; email: string; role: string; token: string; expires_at: string };
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const expires = new Date(invitation.expires_at);
  const expiresIn = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  async function copyLink() {
    const url = `${window.location.origin}/invite/${invitation.token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 1500);
  }

  function onRevoke() {
    if (!confirm(`Revoke invitation for ${invitation.email}?`)) return;
    startTransition(async () => {
      const res = await revokeInvitation(invitation.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Revoked');
        router.refresh();
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-6 py-3">
      <div className="min-w-0">
        <div className="font-medium">{invitation.email}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {invitation.role.replace('_', ' ')} · expires in {expiresIn}d
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={copyLink}
          title="Copy invite link"
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
        {canManage ? (
          <button
            onClick={onRevoke}
            disabled={isPending}
            title="Revoke"
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
