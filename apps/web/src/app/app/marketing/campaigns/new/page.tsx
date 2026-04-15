import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { NewCampaignForm } from './new-campaign-form';

export default async function NewCampaignPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data: segments } = await supabase
    .from('segments')
    .select('id, name')
    .order('name');

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/app/marketing/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to campaigns
      </Link>
      <PageHeader title="New campaign" description="Draft it now, review, then send." />
      <div className="rounded-lg border bg-card p-6">
        <NewCampaignForm segments={segments ?? []} />
      </div>
    </div>
  );
}
