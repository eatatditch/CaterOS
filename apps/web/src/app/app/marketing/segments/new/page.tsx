import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { NewSegmentForm } from './new-segment-form';

export default async function NewSegmentPage() {
  await requireCurrent();

  return (
    <div className="container max-w-2xl py-8">
      <Link
        href="/app/marketing/segments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to segments
      </Link>
      <PageHeader title="New segment" />
      <div className="rounded-lg border bg-card p-6">
        <NewSegmentForm />
      </div>
    </div>
  );
}
