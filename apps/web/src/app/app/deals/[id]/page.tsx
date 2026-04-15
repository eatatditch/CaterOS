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
import { ContactEmailPanel } from '@/components/contact-email-panel';
import { DealHeaderActions } from './deal-header-actions';

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

  const [
    { data: stages },
    { data: activities },
    { data: linkedContact },
  ] = await Promise.all([
    supabase
      .from('stages')
      .select('id, name, position')
      .eq('pipeline_id', deal.pipeline_id)
      .order('position'),
    supabase
      .from('activities')
      .select('*')
      .eq('deal_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    deal.contact_id
      ? supabase
          .from('contacts')
          .select('id, first_name, last_name, email, phone')
          .eq('id', deal.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

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
        actions={<DealHeaderActions dealId={deal.id} dealTitle={deal.title} />}
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

          {linkedContact ? (
            <ContactEmailPanel
              contactId={linkedContact.id}
              contactEmail={linkedContact.email}
            />
          ) : null}

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Log an activity</h2>
            <NewActivityForm dealId={id} contactId={deal.contact_id ?? undefined} />
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <ActivityTimeline activities={activities ?? []} />
          </section>
        </div>

        <aside className="space-y-4">
          {linkedContact ? (
            <div className="rounded-lg border bg-card p-4 text-sm">
              <div className="mb-2 font-semibold">Contact</div>
              <Link
                href={`/app/contacts/${linkedContact.id}`}
                className="block font-medium hover:text-primary"
              >
                {[linkedContact.first_name, linkedContact.last_name]
                  .filter(Boolean)
                  .join(' ') || '(no name)'}
              </Link>
              {linkedContact.email ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {linkedContact.email}
                </div>
              ) : null}
              {linkedContact.phone ? (
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {linkedContact.phone}
                </div>
              ) : null}
            </div>
          ) : null}
          {deal.source ? (
            <div className="rounded-lg border bg-card p-4 text-sm">
              <div className="mb-1 font-semibold">Source</div>
              <div className="text-muted-foreground">{deal.source}</div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
