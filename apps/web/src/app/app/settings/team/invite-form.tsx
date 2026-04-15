'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy, Check } from 'lucide-react';
import { inviteMember } from '@/lib/actions/team';
import {
  Field,
  inputCls,
  selectCls,
  buttonPrimaryCls,
} from '@/components/ui/field';

const roles = [
  { value: 'manager', label: 'Manager — runs bookings, menus, events' },
  { value: 'sales', label: 'Sales — CRM, quotes' },
  { value: 'ops', label: 'Ops — menus, events, dispatch' },
  { value: 'driver', label: 'Driver — dispatch only' },
  { value: 'read_only', label: 'Read only — view reports' },
  { value: 'owner', label: 'Owner — full control' },
];

export function InviteForm({ currentRole }: { currentRole: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const roleOptions = currentRole === 'owner' ? roles : roles.filter((r) => r.value !== 'owner');

  function onSubmit(fd: FormData) {
    setError(null);
    setInviteLink(null);
    startTransition(async () => {
      const res = await inviteMember(fd);
      if (res && 'error' in res && res.error) {
        setError(res.error);
        toast.error(res.error);
      } else if (res && 'ok' in res && res.ok) {
        toast.success('Invitation sent');
        if (res.inviteUrl) setInviteLink(res.inviteUrl);
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Copied');
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <form ref={formRef} action={onSubmit} className="space-y-3">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="teammate@example.com"
            className={inputCls}
          />
        </Field>
        <Field label="Role" htmlFor="role">
          <select id="role" name="role" defaultValue="sales" className={selectCls}>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
          {isPending ? 'Sending…' : 'Send invitation'}
        </button>
      </form>

      {inviteLink ? (
        <div className="mt-4 rounded-md border border-dashed bg-muted/30 p-3 text-xs">
          <div className="mb-1 font-semibold">Or share this link</div>
          <div className="flex items-start gap-2">
            <code className="flex-1 overflow-x-auto break-all rounded bg-background px-2 py-1 text-[11px]">
              {inviteLink}
            </code>
            <button
              onClick={copyLink}
              className="shrink-0 rounded p-1 hover:bg-accent"
              aria-label="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
