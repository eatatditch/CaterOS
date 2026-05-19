import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { buttonPrimaryCls } from '@/components/ui/field';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, string> = {
  cold: 'bg-sky-500/10 text-sky-700',
  warming: 'bg-amber-500/10 text-amber-700',
  converted_to_lead: 'bg-emerald-500/10 text-emerald-700',
  dead: 'bg-muted text-muted-foreground',
};

export default async function ProspectsPage() {
  await requirePermission('deals.manage');
  const supabase = await createClient();

  const { data: prospects } = await supabase
    .from('prospects')
    .select('id, company_name, contact_name, segment, status, next_touch_at, last_touched_at')
    .order('next_touch_at', { ascending: true, nullsFirst: false })
    .limit(200);

  return (
    <div className="container py-8">
      <PageHeader
        title="Prospects"
        description="Your outbound list — companies you haven't qualified yet."
        actions={
          <Link href="/app/prospects/new" className={buttonPrimaryCls}>
            <Plus className="mr-1 h-4 w-4" /> Add prospect
          </Link>
        }
      />

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Company</th>
              <th className="px-4 py-2 text-left font-medium">Contact</th>
              <th className="px-4 py-2 text-left font-medium">Segment</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Next touch</th>
              <th className="px-4 py-2 text-left font-medium">Last touched</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(prospects ?? []).map((p) => (
              <tr key={p.id} className="hover:bg-accent/30">
                <td className="px-4 py-3">
                  <Link href={`/app/prospects/${p.id}`} className="font-medium hover:underline">
                    {p.company_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.contact_name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.segment.replace('_', ' ')}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[p.status] ?? ''}`}
                  >
                    {p.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.next_touch_at
                    ? new Date(p.next_touch_at).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.last_touched_at
                    ? new Date(p.last_touched_at).toLocaleDateString()
                    : 'never'}
                </td>
              </tr>
            ))}
            {(prospects ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No prospects yet.{' '}
                  <Link href="/app/prospects/new" className="text-primary hover:underline">
                    Add your first one
                  </Link>
                  .
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
