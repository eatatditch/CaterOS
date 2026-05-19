import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { AdSpendForm } from './ad-spend-form';
import { AdSpendList } from './ad-spend-list';

export const dynamic = 'force-dynamic';

export default async function AdSpendPage() {
  const ctx = await requirePermission('org.manage');
  const supabase = await createClient();
  const metrics = supabase.schema('metrics' as never);

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const [{ data: rows }, { data: perf }, { data: locations }] = await Promise.all([
    supabase
      .from('ad_spend')
      .select('*')
      .order('period_start', { ascending: false })
      .limit(100),
    metrics.rpc('ad_performance', {
      p_org: ctx.org.id,
      p_from: start.toISOString(),
      p_to: now.toISOString(),
    }),
    supabase.from('locations').select('id, name').order('name'),
  ]);

  return (
    <div className="container py-8">
      <PageHeader
        title="Ad spend"
        description="Manual entry for now. Designed so Meta/Google API ingestion can plug in later without UI changes."
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Log spend</h2>
          <AdSpendForm locations={locations ?? []} />
        </section>
        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">This month&apos;s performance</h2>
          </header>
          <ul className="divide-y text-sm">
            {(perf ?? []).map((p: PerfRow) => (
              <li key={p.channel} className="px-6 py-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium capitalize">{p.channel}</span>
                  <span className="text-sm font-medium">
                    {formatMoney(p.spend_cents ?? 0, ctx.org.currency)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    {p.leads ?? 0} leads ·{' '}
                    {p.cost_per_lead_cents != null
                      ? formatMoney(p.cost_per_lead_cents, ctx.org.currency)
                      : '—'}
                    /lead
                  </div>
                  <div>
                    {p.booked_deals ?? 0} booked ·{' '}
                    {p.cost_per_booked_cents != null
                      ? formatMoney(p.cost_per_booked_cents, ctx.org.currency)
                      : '—'}
                    /booked
                  </div>
                  <div className="text-right">
                    ROAS {p.roas != null ? `${p.roas}x` : '—'}
                  </div>
                </div>
              </li>
            ))}
            {(perf ?? []).length === 0 ? (
              <li className="p-6 text-sm text-muted-foreground">
                No spend or performance data yet for this month.
              </li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <header className="border-b px-6 py-4">
          <h2 className="font-semibold">Recent entries</h2>
        </header>
        <AdSpendList rows={rows ?? []} locations={locations ?? []} currency={ctx.org.currency} />
      </section>
    </div>
  );
}

type PerfRow = {
  channel: string;
  spend_cents: number | null;
  leads: number | null;
  booked_deals: number | null;
  cost_per_lead_cents: number | null;
  cost_per_booked_cents: number | null;
  roas: number | null;
};
