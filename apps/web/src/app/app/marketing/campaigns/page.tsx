import Link from 'next/link';
import { ArrowLeft, Plus, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { buttonPrimaryCls } from '@/components/ui/field';

export default async function CampaignsPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('campaigns')
    .select('id, name, subject, status, sent_at, sent_count, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href="/app/marketing"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to marketing
      </Link>
      <PageHeader
        title="Campaigns"
        description="One-off email broadcasts to a segment of your contacts."
        actions={
          <Link href="/app/marketing/campaigns/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        }
      />

      {data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.id}>
              <Link
                href={`/app/marketing/campaigns/${c.id}`}
                className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.name}</div>
                    <div className="truncate text-sm text-muted-foreground">{c.subject}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge
                      label={c.status}
                      tone={
                        c.status === 'sent'
                          ? 'green'
                          : c.status === 'scheduled'
                            ? 'blue'
                            : c.status === 'sending'
                              ? 'yellow'
                              : 'gray'
                      }
                    />
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {c.sent_at
                        ? `${c.sent_count} sent · ${formatDistanceToNow(new Date(c.sent_at), { addSuffix: true })}`
                        : `Created ${formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}`}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Send}
          title="No campaigns yet"
          description="Send a one-off email blast to a segment."
          action={
            <Link href="/app/marketing/campaigns/new" className={buttonPrimaryCls}>
              <Plus className="h-4 w-4" /> New campaign
            </Link>
          }
        />
      )}
    </div>
  );
}
