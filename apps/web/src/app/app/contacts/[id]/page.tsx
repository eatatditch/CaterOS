import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, Mail, Phone } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { ContactForm } from '../contact-form';
import { ActivityTimeline } from '@/components/activity-timeline';
import { NewActivityForm } from '@/components/new-activity-form';

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: contact }, { data: companies }, { data: activities }, { data: deals }] =
    await Promise.all([
      supabase.from('contacts').select('*').eq('id', id).maybeSingle(),
      supabase.from('companies').select('id, name').order('name'),
      supabase
        .from('activities')
        .select('*')
        .eq('contact_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('deals')
        .select('id, title, amount_cents, currency, stages:stage_id (name)')
        .eq('contact_id', id)
        .order('created_at', { ascending: false }),
    ]);

  if (!contact) notFound();

  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Contact';

  return (
    <div className="container py-8">
      <Link
        href="/app/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to contacts
      </Link>
      <PageHeader
        title={fullName}
        description={contact.job_title ?? undefined}
        actions={<StatusBadge label={contact.lifecycle_stage.replace('_', ' ')} tone="blue" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Details</h2>
            <ContactForm initial={contact} companies={companies ?? []} />
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Log an activity</h2>
            <NewActivityForm contactId={contact.id} />
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Timeline</h2>
            <ActivityTimeline activities={activities ?? []} />
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4 text-sm">
            <div className="mb-2 font-semibold">Quick info</div>
            {contact.email ? (
              <div className="flex items-center gap-2 py-1 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                  {contact.email}
                </a>
              </div>
            ) : null}
            {contact.phone ? (
              <div className="flex items-center gap-2 py-1 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a href={`tel:${contact.phone}`} className="hover:text-foreground">
                  {contact.phone}
                </a>
              </div>
            ) : null}
            {contact.company_id ? (
              <div className="flex items-center gap-2 py-1 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <Link
                  href={`/app/companies/${contact.company_id}`}
                  className="hover:text-foreground"
                >
                  View company
                </Link>
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border bg-card p-4 text-sm">
            <div className="mb-2 font-semibold">Deals ({deals?.length ?? 0})</div>
            {deals && deals.length > 0 ? (
              <ul className="space-y-2">
                {(deals as unknown as Array<{
                  id: string;
                  title: string;
                  amount_cents: number;
                  currency: string;
                  stages: { name: string } | { name: string }[] | null;
                }>).map((d) => {
                  const stageName = Array.isArray(d.stages)
                    ? d.stages[0]?.name
                    : d.stages?.name;
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/app/deals/${d.id}`}
                        className="flex items-center justify-between rounded px-2 py-1 hover:bg-accent"
                      >
                        <span className="truncate pr-2">{d.title}</span>
                        <span className="text-xs text-muted-foreground">{stageName ?? '—'}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-muted-foreground">No deals yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
