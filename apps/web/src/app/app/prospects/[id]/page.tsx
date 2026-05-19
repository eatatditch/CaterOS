import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { ProspectForm } from '../prospect-form';
import { ActivityTimeline } from '@/components/activity-timeline';
import { NewActivityForm } from '@/components/new-activity-form';
import { convertProspectToLead } from '@/lib/actions/prospects';
import { buttonPrimaryCls } from '@/components/ui/field';

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('deals.manage');
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: prospect }, { data: locations }, { data: activities }] = await Promise.all([
    supabase.from('prospects').select('*').eq('id', id).maybeSingle(),
    supabase.from('locations').select('id, name').order('name'),
    supabase
      .from('activities')
      .select('*')
      .eq('prospect_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (!prospect) notFound();

  async function convert() {
    'use server';
    await convertProspectToLead(id);
  }

  return (
    <div className="container py-8">
      <Link
        href="/app/prospects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to prospects
      </Link>
      <PageHeader
        title={prospect.company_name}
        description={`${prospect.segment.replace('_', ' ')} · ${prospect.status.replace('_', ' ')}`}
        actions={
          prospect.status !== 'converted_to_lead' ? (
            <form action={convert}>
              <button type="submit" className={buttonPrimaryCls}>
                Convert to lead <ArrowRight className="ml-1 h-4 w-4" />
              </button>
            </form>
          ) : prospect.converted_deal_id ? (
            <Link
              href={`/app/deals/${prospect.converted_deal_id}`}
              className="text-sm text-primary hover:underline"
            >
              View deal →
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Details</h2>
            <ProspectForm initial={prospect} locations={locations ?? []} />
          </section>

          <section className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 font-semibold">Log activity</h2>
            <NewActivityForm prospectId={id} />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border bg-card p-6">
            <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
            {prospect.last_touched_at ? (
              <div className="mb-3 text-xs text-muted-foreground">
                Last touched{' '}
                {formatDistanceToNow(new Date(prospect.last_touched_at), { addSuffix: true })}
              </div>
            ) : null}
            <ActivityTimeline activities={activities ?? []} />
          </section>
        </aside>
      </div>
    </div>
  );
}
