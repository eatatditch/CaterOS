import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DealForm } from '../deal-form';

export default async function NewDealPage() {
  await requireCurrent();
  const supabase = await createClient();
  const [{ data: pipeline }, { data: contacts }, { data: companies }] = await Promise.all([
    supabase
      .from('pipelines')
      .select('id, name, stages:id(id, name, position)')
      .eq('is_default', true)
      .limit(1)
      .maybeSingle(),
    supabase.from('contacts').select('id, first_name, last_name').order('last_name').limit(500),
    supabase.from('companies').select('id, name').order('name').limit(500),
  ]);

  // stages nested query - fetch separately
  const { data: stages } = await supabase
    .from('stages')
    .select('id, name, position')
    .eq('pipeline_id', pipeline?.id ?? '')
    .order('position');

  return (
    <div className="container max-w-2xl py-8">
      <Link
        href="/app/pipeline"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </Link>
      <PageHeader title="New deal" description="Track a new opportunity in your pipeline." />
      <div className="rounded-lg border bg-card p-6">
        <DealForm
          pipelineId={pipeline?.id ?? ''}
          stages={stages ?? []}
          contacts={(contacts ?? []).map((c) => ({
            id: c.id,
            label: [c.first_name, c.last_name].filter(Boolean).join(' '),
          }))}
          companies={companies ?? []}
        />
      </div>
    </div>
  );
}
