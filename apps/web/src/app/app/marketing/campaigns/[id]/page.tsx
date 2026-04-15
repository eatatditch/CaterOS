import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { CampaignActions } from './campaign-actions';

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*, segments:segment_id (id, name)')
    .eq('id', id)
    .maybeSingle();
  if (!campaign) notFound();

  let recipientCount = 0;
  if (campaign.segment_id) {
    const { data } = await supabase.rpc('segment_contacts', {
      p_segment_id: campaign.segment_id,
    });
    recipientCount = ((data ?? []) as string[]).length;
  } else {
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('do_not_email', false)
      .not('email', 'is', null);
    recipientCount = count ?? 0;
  }

  const segmentName =
    (campaign.segments as unknown as { name: string } | null)?.name ?? 'All contacts';

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/app/marketing/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </Link>
      <PageHeader
        title={campaign.name}
        description={`${segmentName} · ${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge
              label={campaign.status}
              tone={
                campaign.status === 'sent'
                  ? 'green'
                  : campaign.status === 'scheduled'
                    ? 'blue'
                    : 'gray'
              }
            />
            <CampaignActions
              campaignId={id}
              status={campaign.status}
              recipientCount={recipientCount}
            />
          </div>
        }
      />

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground">Subject</div>
          <div className="text-lg font-semibold">{campaign.subject}</div>
        </div>
        <div
          className="prose prose-sm max-w-none rounded-md border bg-muted/10 p-4"
          dangerouslySetInnerHTML={{ __html: campaign.body_html }}
        />
      </section>

      {campaign.sent_at ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Sent {new Date(campaign.sent_at).toLocaleString()} · {campaign.sent_count} delivered
        </p>
      ) : null}
    </div>
  );
}
