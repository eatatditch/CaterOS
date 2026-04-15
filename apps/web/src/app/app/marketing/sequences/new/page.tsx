import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { NewSequenceForm } from './new-sequence-form';

export default async function NewSequencePage() {
  await requireCurrent();
  return (
    <div className="container max-w-2xl py-8">
      <Link
        href="/app/marketing/sequences"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sequences
      </Link>
      <PageHeader title="New sequence" description="Once created, add steps and activate." />
      <div className="rounded-lg border bg-card p-6">
        <NewSequenceForm />
      </div>
    </div>
  );
}
