import Link from 'next/link';
import { Kanban, Plus } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonPrimaryCls } from '@/components/ui/field';
import { PipelineBoard } from './pipeline-board';

export default async function PipelinePage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  if (!pipeline) {
    return (
      <div className="container py-8">
        <EmptyState
          icon={Kanban}
          title="No pipeline found"
          description="Your org should have a default pipeline. Try signing out and back in."
        />
      </div>
    );
  }

  const { data: stages } = await supabase
    .from('stages')
    .select('id, name, position, probability, is_won, is_lost')
    .eq('pipeline_id', pipeline.id)
    .order('position');

  const { data: deals } = await supabase
    .from('deals')
    .select(
      'id, title, amount_cents, currency, stage_id, contact_id, company_id, expected_close_date, contacts:contact_id (first_name, last_name), companies:company_id (name)',
    )
    .eq('pipeline_id', pipeline.id)
    .order('created_at', { ascending: false });

  const totalCents = (deals ?? []).reduce((sum, d) => sum + (d.amount_cents ?? 0), 0);

  return (
    <div className="container py-8">
      <PageHeader
        title="Pipeline"
        description={`${deals?.length ?? 0} deals · ${formatMoney(totalCents, ctx.org.currency)} in pipeline`}
        actions={
          <Link href="/app/deals/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New deal
          </Link>
        }
      />

      {stages && stages.length > 0 ? (
        <PipelineBoard
          stages={stages}
          deals={(deals ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            stage_id: d.stage_id,
            amount_cents: d.amount_cents,
            currency: d.currency,
            expected_close_date: d.expected_close_date,
            contact_name: d.contacts
              ? [
                  (d.contacts as unknown as { first_name: string | null }).first_name,
                  (d.contacts as unknown as { last_name: string | null }).last_name,
                ]
                  .filter(Boolean)
                  .join(' ')
              : null,
            company_name: (d.companies as unknown as { name: string } | null)?.name ?? null,
          }))}
        />
      ) : (
        <EmptyState
          icon={Kanban}
          title="No stages configured"
          description="Configure stages for your pipeline in Settings."
        />
      )}
    </div>
  );
}
