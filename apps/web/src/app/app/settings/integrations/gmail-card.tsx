'use client';

import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, Check, Mail } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { disconnectGmail } from '@/lib/actions/gmail';

export function GmailCard({
  connection,
  hasCredentials,
  canManage,
  appUrl,
}: {
  connection: { id: string; email: string; createdAt: string } | null;
  hasCredentials: boolean;
  canManage: boolean;
  appUrl: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState<string | null>(null);

  const redirectUri = `${appUrl}/api/gmail/oauth/callback`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied');
    setTimeout(() => setCopied(null), 1500);
  }

  function handleDisconnect() {
    if (!confirm('Disconnect Gmail? Emails will stop syncing and sending.')) return;
    startTransition(async () => {
      const res = await disconnectGmail();
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Gmail disconnected');
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Gmail</h2>
            <p className="text-xs text-muted-foreground">
              Send and view emails from your catering inbox without leaving CaterOS.
            </p>
          </div>
        </div>

        {connection ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800 dark:bg-green-500/15 dark:text-green-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not connected
          </span>
        )}
      </header>

      {connection ? (
        <div className="p-6">
          <div className="mb-3 text-sm">
            <span className="text-muted-foreground">Connected mailbox:</span>{' '}
            <span className="font-medium">{connection.email}</span>
          </div>
          <div className="mb-4 text-xs text-muted-foreground">
            Connected{' '}
            {new Date(connection.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
            . All team members can send emails from this address, and your{' '}
            <Link
              href="/app/contacts"
              className="font-medium text-primary hover:underline"
            >
              contact detail pages
            </Link>{' '}
            now show a live email thread from Gmail.
          </div>
          {canManage ? (
            <button
              onClick={handleDisconnect}
              disabled={isPending}
              className="inline-flex h-9 items-center rounded-md border border-destructive/40 bg-background px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {isPending ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : null}
        </div>
      ) : !hasCredentials ? (
        <div className="p-6">
          <div className="mb-3 rounded-md border border-yellow-400/40 bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-500/10 dark:text-yellow-200">
            <strong>Gmail OAuth isn&apos;t configured yet.</strong> Set up a Google Cloud project and
            add your client ID + secret to Vercel before connecting.
          </div>

          <h3 className="mb-2 text-sm font-semibold">Setup steps</h3>
          <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Go to{' '}
              <a
                href="https://console.cloud.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google Cloud Console
              </a>{' '}
              and create a project (or pick an existing one).
            </li>
            <li>
              <strong>APIs &amp; Services → Library</strong> → search for &ldquo;Gmail API&rdquo; →{' '}
              <strong>Enable</strong>.
            </li>
            <li>
              <strong>APIs &amp; Services → OAuth consent screen</strong> → user type{' '}
              <strong>External</strong> → fill name, support email, developer email. Add these scopes:
              <ul className="mt-1 list-disc pl-5">
                <li>
                  <code className="rounded bg-muted px-1 text-xs">.../auth/gmail.send</code>
                </li>
                <li>
                  <code className="rounded bg-muted px-1 text-xs">.../auth/gmail.readonly</code>
                </li>
                <li>
                  <code className="rounded bg-muted px-1 text-xs">.../auth/userinfo.email</code>
                </li>
              </ul>
              Add your Gmail address as a test user while in Testing mode.
            </li>
            <li>
              <strong>Credentials → Create Credentials → OAuth Client ID</strong> → Application type{' '}
              <strong>Web application</strong>. Under &ldquo;Authorized redirect URIs&rdquo;, add:
              <div className="mt-2 flex items-center gap-2 rounded border bg-muted/40 p-2 text-xs">
                <code className="flex-1 break-all">{redirectUri}</code>
                <button
                  onClick={() => copy(redirectUri, 'uri')}
                  className="rounded p-1 hover:bg-accent"
                  aria-label="Copy redirect URI"
                >
                  {copied === 'uri' ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </li>
            <li>
              Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> into Vercel →
              Settings → Environment Variables (Production scope):
              <div className="mt-1 space-y-1 font-mono text-xs">
                <div>GOOGLE_OAUTH_CLIENT_ID=your-client-id</div>
                <div>GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret</div>
              </div>
            </li>
            <li>Redeploy. Come back to this page and click &ldquo;Connect Gmail&rdquo;.</li>
          </ol>

          <button
            disabled
            className="inline-flex h-10 items-center rounded-md bg-muted px-4 text-sm font-medium text-muted-foreground"
          >
            Connect Gmail (setup incomplete)
          </button>
        </div>
      ) : (
        <div className="p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Connect your catering mailbox (e.g.{' '}
            <code className="rounded bg-muted px-1 text-xs">catering@eatatditch.com</code>) so your
            whole team can send &amp; read emails from contact pages.
          </p>
          {canManage ? (
            <a
              href="/api/gmail/oauth/start"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Mail className="h-4 w-4" />
              Connect Gmail
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">
              Ask an owner or manager to connect Gmail.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
