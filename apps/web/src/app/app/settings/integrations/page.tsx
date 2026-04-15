import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Mail, AlertTriangle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { GmailCard } from './gmail-card';

export const dynamic = 'force-dynamic';

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await requireCurrent();
  const sp = (await searchParams) ?? {};
  const canManage = ctx.role === 'owner' || ctx.role === 'manager';

  const supabase = await createClient();
  const { data: connection } = await supabase
    .from('gmail_connections')
    .select('id, email, connected_by, created_at')
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hasCredentials = Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href="/app/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to settings
      </Link>

      <PageHeader
        title="Integrations"
        description="Connect external services so CaterOS can send emails, charge cards, and sync data."
      />

      {sp.gmail === 'connected' ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-green-500/40 bg-green-50 p-3 text-sm text-green-900 dark:bg-green-500/10 dark:text-green-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4" /> Gmail connected.
        </div>
      ) : null}
      {sp.gmail && sp.gmail !== 'connected' ? (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          Gmail connection failed: {sp.message ?? sp.gmail}
        </div>
      ) : null}

      <GmailCard
        connection={
          connection
            ? {
                id: connection.id,
                email: connection.email,
                createdAt: connection.created_at,
              }
            : null
        }
        hasCredentials={hasCredentials}
        canManage={canManage}
        appUrl={appUrl}
      />
    </div>
  );
}
