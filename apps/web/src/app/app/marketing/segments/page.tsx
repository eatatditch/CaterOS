import Link from 'next/link';
import { ArrowLeft, Plus, Users2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonPrimaryCls } from '@/components/ui/field';

export default async function SegmentsPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data: segments } = await supabase
    .from('segments')
    .select('id, name, description, kind, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href="/app/marketing"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to marketing
      </Link>
      <PageHeader
        title="Segments"
        description="Filtered lists of contacts you can target with campaigns or sequences."
        actions={
          <Link href="/app/marketing/segments/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New segment
          </Link>
        }
      />

      {segments && segments.length > 0 ? (
        <ul className="space-y-2">
          {segments.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/marketing/segments/${s.id}`}
                className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {s.description ? (
                      <div className="text-sm text-muted-foreground">{s.description}</div>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">
                    {s.kind}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Users2}
          title="No segments yet"
          description="Create a segment to target specific groups of contacts with emails."
          action={
            <Link href="/app/marketing/segments/new" className={buttonPrimaryCls}>
              <Plus className="h-4 w-4" /> New segment
            </Link>
          }
        />
      )}
    </div>
  );
}
