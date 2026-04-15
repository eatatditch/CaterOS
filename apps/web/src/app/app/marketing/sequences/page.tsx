import Link from 'next/link';
import { ArrowLeft, Plus, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { buttonPrimaryCls } from '@/components/ui/field';

export default async function SequencesPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('sequences')
    .select('id, name, description, trigger, status, created_at')
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
        title="Sequences"
        description="Multi-step automated email drips triggered by specific events."
        actions={
          <Link href="/app/marketing/sequences/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New sequence
          </Link>
        }
      />

      {data && data.length > 0 ? (
        <ul className="space-y-2">
          {data.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/marketing/sequences/${s.id}`}
                className="block rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Trigger: <span className="capitalize">{s.trigger.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <StatusBadge
                    label={s.status}
                    tone={
                      s.status === 'active' ? 'green' : s.status === 'paused' ? 'yellow' : 'gray'
                    }
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Zap}
          title="No sequences yet"
          description="Create a multi-step drip flow that fires automatically on a trigger."
          action={
            <Link href="/app/marketing/sequences/new" className={buttonPrimaryCls}>
              <Plus className="h-4 w-4" /> New sequence
            </Link>
          }
        />
      )}
    </div>
  );
}
