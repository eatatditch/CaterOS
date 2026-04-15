import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: segment } = await supabase
    .from('segments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!segment) notFound();

  // Evaluate member count via RPC
  const { data: memberIds } = await supabase.rpc('segment_contacts', {
    p_segment_id: id,
  });
  const ids = ((memberIds ?? []) as string[]) ?? [];

  const { data: contacts } =
    ids.length > 0
      ? await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, lifecycle_stage')
          .in('id', ids)
          .limit(100)
      : { data: [] };

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href="/app/marketing/segments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to segments
      </Link>
      <PageHeader
        title={segment.name}
        description={`${ids.length} matching contact${ids.length === 1 ? '' : 's'} · ${segment.kind}`}
      />

      {segment.description ? (
        <p className="mb-4 text-sm text-muted-foreground">{segment.description}</p>
      ) : null}

      <section className="rounded-lg border bg-card">
        <header className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Matching contacts</h2>
        </header>
        {contacts && contacts.length > 0 ? (
          <ul className="divide-y text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-2.5">
                <Link
                  href={`/app/contacts/${c.id}`}
                  className="min-w-0 flex-1 truncate hover:text-primary"
                >
                  <span className="font-medium">
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || 'No name'}
                  </span>
                  {c.email ? (
                    <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>
                  ) : null}
                </Link>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] capitalize text-muted-foreground">
                  {c.lifecycle_stage}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">No contacts match this segment.</p>
        )}
      </section>

      <details className="mt-4 rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        <summary className="cursor-pointer font-medium">Raw filter JSON</summary>
        <pre className="mt-2 overflow-x-auto">{JSON.stringify(segment.filters, null, 2)}</pre>
      </details>
    </div>
  );
}
