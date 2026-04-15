import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DealForm } from '../deal-form';
import { ActivityTimeline } from '@/components/activity-timeline';
import { NewActivityForm } from '@/components/new-activity-form';

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: deal }, { data: contacts }, { data: companies }] = await Promise.all([
    supabase.from('deals').select('*, stages:stage_id (name, probability)').eq('id', id).maybeSingle(),
    supabase.from('contacts').select('id, first_name, last_name').order('last_name').limit(500),
    supabase.from('companies').select('id, name').order('name').limit(500),
  ]);

  if (!deal) notFound();

  const { data: stages } = await supabase
    .from('stages')
    .select('id, name, position')
    .eq('pipeline_id', deal.pipeline_id)
    .order('position');

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="container py-8">
      <Link
        href="/app/pipeline"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </Link>
      <PageHeader
        title={deal.title}
        description={`${(deal.stages as unknown as { name: string } | null)?.name ?? ''} · ${formatMoney(deal.amount_cents, deal.currency)}`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Deal details</h2>
            <DealForm
              initial={deal}
              pipelineId={deal.pipeline_id}
              stages={stages ?? []}
              contacts={(contacts ?? []).map((c) => ({
                id: c.id,
                label: [c.first_name, c.last_name].filter(Boolean).join(' '),
              }))}
              companies={companies ?? []}
            />
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Log an activity</h2>
            <NewActivityForm dealId={id} contactId={deal.contact_id ?? undefined} />
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <ActivityTimeline activities={activities ?? []} />
          </section>
        </div>
      </div>
    </div>
  );
}
