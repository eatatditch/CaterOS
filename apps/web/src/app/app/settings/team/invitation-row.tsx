'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, X, Send } from 'lucide-react';
import { toast } from 'sonner';
import { resendInvitation, revokeInvitation } from '@/lib/actions/team';

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

  async function copyLink(token: string = invitation.token) {
    const url = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 1500);
  }

  function onResend() {
    startTransition(async () => {
      const res = await resendInvitation(invitation.id);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      if (res.emailed === 'gmail') {
        toast.success(`Invite resent to ${invitation.email} via Gmail`);
      } else if (res.emailed === 'supabase') {
        toast.success(`Invite resent to ${invitation.email}`);
      } else {
        toast.message(
          'Couldn’t send email automatically — link copied so you can share it manually. Connect Gmail in Integrations for auto-send.',
        );
        if (res.inviteUrl) {
          await navigator.clipboard.writeText(res.inviteUrl);
        }
      }
      router.refresh();
    });
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
        {canManage ? (
          <button
            onClick={onResend}
            disabled={isPending}
            title="Resend invite email"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        ) : null}
        <button
          onClick={() => copyLink()}
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
