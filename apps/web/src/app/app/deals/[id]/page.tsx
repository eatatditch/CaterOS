import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, MapPin, MessageSquare, Users } from 'lucide-react';
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

  const stageName = (deal.stages as unknown as { name: string } | null)?.name ?? '';
  const isLead = stageName === 'Lead';

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

  const customFields = (deal.custom_fields ?? {}) as Record<string, unknown>;

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
        description={`${stageName} · ${formatMoney(deal.amount_cents, deal.currency)}`}
        actions={<DealHeaderActions dealId={deal.id} dealTitle={deal.title} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {isLead ? (
            <InquiryCard
              contact={linkedContact}
              deal={deal}
              customFields={customFields}
              currency={deal.currency}
            />
          ) : (
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
          )}

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

function InquiryCard({
  contact,
  deal,
  customFields,
  currency,
}: {
  contact: { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null } | null;
  deal: { title: string; expected_close_date: string | null; amount_cents: number; source: string | null; created_at: string };
  customFields: Record<string, unknown>;
  currency: string;
}) {
  const headcount = Number(customFields.headcount) || 0;
  const serviceType = String(customFields.service_type_raw ?? '').replace(/_/g, ' ') || null;
  const eventTime = String(customFields.event_time ?? '') || null;
  const message = String(customFields.message ?? '') || null;
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : null;
  const eventDate = deal.expected_close_date
    ? new Date(deal.expected_close_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-6 py-4">
        <h2 className="font-semibold">Inquiry details</h2>
        <p className="text-xs text-muted-foreground">
          Submitted {new Date(deal.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          {deal.source ? ` via ${deal.source.replace('_', ' ')}` : ''}
        </p>
      </header>
      <div className="divide-y">
        {/* Contact info */}
        <div className="grid gap-x-8 gap-y-3 px-6 py-4 sm:grid-cols-2">
          <InfoRow label="Name" value={contactName} />
          <InfoRow label="Email" value={contact?.email} />
          <InfoRow label="Phone" value={contact?.phone} />
          {deal.amount_cents > 0 ? (
            <InfoRow label="Estimated budget" value={formatMoney(deal.amount_cents, currency)} />
          ) : null}
        </div>

        {/* Event details */}
        <div className="grid gap-x-8 gap-y-3 px-6 py-4 sm:grid-cols-2">
          <InfoRow label="Event date" value={eventDate} icon={<Calendar className="h-3.5 w-3.5" />} />
          {eventTime ? <InfoRow label="Event time" value={eventTime} /> : null}
          {headcount > 0 ? (
            <InfoRow label="Guest count" value={`${headcount} guests`} icon={<Users className="h-3.5 w-3.5" />} />
          ) : null}
          {serviceType ? (
            <InfoRow label="Service type" value={serviceType} icon={<MapPin className="h-3.5 w-3.5" />} />
          ) : null}
        </div>

        {/* Message */}
        {message ? (
          <div className="px-6 py-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </div>
            <p className="whitespace-pre-wrap text-sm">{message}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
