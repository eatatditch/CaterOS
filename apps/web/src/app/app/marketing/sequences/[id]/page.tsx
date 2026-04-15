import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { SequenceActions } from './sequence-actions';
import { StepList } from './step-list';
import { AddStepForm } from './add-step-form';

export default async function SequenceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: sequence } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!sequence) notFound();

  const { data: steps } = await supabase
    .from('sequence_steps')
    .select('id, position, delay_hours, subject, body_html')
    .eq('sequence_id', id)
    .order('position');

  const { count: enrollmentCount } = await supabase
    .from('sequence_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('sequence_id', id)
    .eq('status', 'active');

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/app/marketing/sequences"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sequences
      </Link>
      <PageHeader
        title={sequence.name}
        description={`Trigger: ${sequence.trigger.replace('_', ' ')} · ${enrollmentCount ?? 0} active enrollment${enrollmentCount === 1 ? '' : 's'}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge
              label={sequence.status}
              tone={
                sequence.status === 'active'
                  ? 'green'
                  : sequence.status === 'paused'
                    ? 'yellow'
                    : 'gray'
              }
            />
            <SequenceActions id={id} status={sequence.status} stepCount={steps?.length ?? 0} />
          </div>
        }
      />

      {sequence.description ? (
        <p className="mb-4 text-sm text-muted-foreground">{sequence.description}</p>
      ) : null}

      <section className="mb-6 rounded-lg border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="font-semibold">Steps ({steps?.length ?? 0})</h2>
        </header>
        <StepList sequenceId={id} steps={steps ?? []} />
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">Add a step</h2>
        <AddStepForm sequenceId={id} nextPosition={steps?.length ?? 0} />
      </section>
    </div>
  );
}
