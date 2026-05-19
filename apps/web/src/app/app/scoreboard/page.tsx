import Link from 'next/link';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

type RangeKey = 'wtd' | 'mtd' | 'qtd' | 'ytd';

function range(key: RangeKey): { from: Date; to: Date; label: string } {
  const to = new Date();
  const from = new Date(to);
  switch (key) {
    case 'wtd': {
      const day = from.getDay();
      const diff = (day + 6) % 7; // Monday start
      from.setDate(from.getDate() - diff);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: 'Week to date' };
    }
    case 'mtd':
      from.setDate(1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: 'Month to date' };
    case 'qtd': {
      const q = Math.floor(from.getMonth() / 3);
      from.setMonth(q * 3, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: 'Quarter to date' };
    }
    case 'ytd':
      from.setMonth(0, 1);
      from.setHours(0, 0, 0, 0);
      return { from, to, label: 'Year to date' };
  }
}

const BAND_STYLES: Record<string, { label: string; classes: string }> = {
  healthy: { label: 'Healthy', classes: 'bg-emerald-500/10 text-emerald-600' },
  watch: { label: 'Watch', classes: 'bg-amber-500/10 text-amber-700' },
  at_risk: { label: 'At risk', classes: 'bg-destructive/10 text-destructive' },
  goal_hit: { label: 'Goal hit', classes: 'bg-blue-500/10 text-blue-600' },
};

export default async function ScoreboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const ctx = await requirePermission('reports.read');
  const { range: rangeParam } = await searchParams;
  const rangeKey: RangeKey = (['wtd', 'mtd', 'qtd', 'ytd'].includes(rangeParam ?? '')
    ? rangeParam
    : 'mtd') as RangeKey;
  const { from, to, label } = range(rangeKey);

  const supabase = await createClient();
  const metrics = supabase.schema('metrics' as never);

  const args = {
    p_org: ctx.org.id,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  };

  const [
    { data: revenue },
    { data: scorecard },
    { data: coverage },
    { data: response },
    { data: funnel },
    { data: lost },
    { data: unanswered },
    { data: stale },
  ] = await Promise.all([
    metrics.rpc('revenue_summary', args).single(),
    metrics.rpc('manager_scorecard', args),
    metrics
      .rpc('coverage_ratio', {
        p_org: ctx.org.id,
        p_as_of: to.toISOString(),
        p_period: rangeKey === 'qtd' ? 'quarterly' : rangeKey === 'wtd' ? 'weekly' : 'monthly',
      })
      .single(),
    metrics.rpc('response_speed', args).single(),
    metrics.rpc('funnel_counts', args),
    metrics.rpc('lost_reasons', args),
    metrics.rpc('unanswered_leads', { p_org: ctx.org.id }),
    metrics.rpc('stale_leads', { p_org: ctx.org.id, p_days: 7 }),
  ]);

  const r = (revenue ?? {}) as {
    booked_cents?: number;
    delivered_cents?: number;
    pipeline_cents?: number;
    weighted_pipeline_cents?: number;
    open_deal_count?: number;
    won_deal_count?: number;
  };
  const c = (coverage ?? {}) as {
    open_pipeline_cents?: number;
    revenue_goal_cents?: number;
    booked_cents?: number;
    remaining_goal_cents?: number;
    ratio?: number;
    band?: string;
  };
  const rs = (response ?? {}) as {
    total_leads?: number;
    responded?: number;
    awaiting_response?: number;
    avg_minutes?: number;
    under_4h?: number;
    between_4h_and_24h?: number;
    over_24h?: number;
  };

  return (
    <div className="container py-8">
      <PageHeader
        title="Scoreboard"
        description={`${label} · ${from.toLocaleDateString()} – ${to.toLocaleDateString()}`}
        actions={<RangePicker active={rangeKey} />}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Booked revenue"
          value={formatMoney(r.booked_cents ?? 0, ctx.org.currency)}
          hint={`${r.won_deal_count ?? 0} wins`}
          Icon={DollarSign}
        />
        <Stat
          label="Pipeline (weighted)"
          value={formatMoney(r.weighted_pipeline_cents ?? 0, ctx.org.currency)}
          hint={`${r.open_deal_count ?? 0} open · ${formatMoney(r.pipeline_cents ?? 0, ctx.org.currency)} face value`}
          Icon={TrendingUp}
        />
        <Stat
          label="Coverage ratio"
          value={c.ratio != null ? `${c.ratio.toFixed(1)}x` : '—'}
          hint={
            c.band && BAND_STYLES[c.band]?.label
              ? BAND_STYLES[c.band]!.label
              : c.revenue_goal_cents === 0
                ? 'No goal set'
                : ''
          }
          band={c.band}
          Icon={Calendar}
        />
        <Stat
          label="Avg first response"
          value={rs.avg_minutes != null ? formatDuration(rs.avg_minutes) : '—'}
          hint={`${rs.awaiting_response ?? 0} still waiting`}
          tone={rs.avg_minutes != null && rs.avg_minutes > 240 ? 'warn' : undefined}
          Icon={Clock}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card lg:col-span-2">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">Per-manager performance</h2>
            <p className="text-xs text-muted-foreground">{label}</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Manager</th>
                  <th className="px-4 py-2 text-right font-medium">Booked</th>
                  <th className="px-4 py-2 text-right font-medium">Pipeline</th>
                  <th className="px-4 py-2 text-right font-medium">Open</th>
                  <th className="px-4 py-2 text-right font-medium">Win %</th>
                  <th className="px-4 py-2 text-right font-medium">Avg resp</th>
                  <th className="px-4 py-2 text-right font-medium">Unanswered</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(scorecard ?? []).map((row: ScorecardRow) => (
                  <tr key={row.owner_id ?? row.full_name}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.full_name ?? '—'}</div>
                      <div className="text-xs capitalize text-muted-foreground">
                        {row.role?.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(row.booked_cents ?? 0, ctx.org.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(row.pipeline_cents ?? 0, ctx.org.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">{row.open_deal_count ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      {row.lead_to_won_pct != null ? `${row.lead_to_won_pct}%` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.avg_response_minutes != null
                        ? formatDuration(row.avg_response_minutes)
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.unanswered_leads ? (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                          {row.unanswered_leads}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(scorecard ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No managers found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">Response time</h2>
            <p className="text-xs text-muted-foreground">Inbound leads in window</p>
          </header>
          <div className="space-y-3 p-6 text-sm">
            <Bar
              label="Under 4h"
              count={rs.under_4h ?? 0}
              total={rs.total_leads ?? 0}
              tone="ok"
            />
            <Bar
              label="4–24h"
              count={rs.between_4h_and_24h ?? 0}
              total={rs.total_leads ?? 0}
              tone="warn"
            />
            <Bar
              label="Over 24h"
              count={rs.over_24h ?? 0}
              total={rs.total_leads ?? 0}
              tone="bad"
            />
            <div className="pt-2 text-xs text-muted-foreground">
              {rs.total_leads ?? 0} total · {rs.awaiting_response ?? 0} still awaiting
            </div>
          </div>
        </section>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">Funnel</h2>
          </header>
          <ul className="divide-y text-sm">
            {(funnel ?? []).map((s: FunnelRow) => (
              <li key={s.stage_id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <div className="font-medium">{s.stage_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.deals_reached} reached · {s.deals_created} created
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatMoney(s.pipeline_cents ?? 0, ctx.org.currency)}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="font-semibold">Unanswered leads</h2>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </header>
          {(unanswered ?? []).length === 0 ? (
            <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Inbox clear.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {(unanswered ?? []).slice(0, 10).map((u: UnansweredRow) => (
                <li key={u.deal_id}>
                  <Link
                    href={`/app/deals/${u.deal_id}`}
                    className="block px-6 py-3 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{u.contact_name ?? u.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDuration(u.minutes_waiting ?? 0)} waiting
                        </div>
                      </div>
                      <div className="shrink-0 text-xs font-medium text-destructive">
                        {(u.minutes_waiting ?? 0) > 1440 ? 'RED' : 'YELLOW'}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">Stale deals</h2>
            <p className="text-xs text-muted-foreground">No activity 7+ days</p>
          </header>
          {(stale ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing stale.</p>
          ) : (
            <ul className="divide-y text-sm">
              {(stale ?? []).slice(0, 10).map((s: StaleRow) => (
                <li key={s.deal_id}>
                  <Link
                    href={`/app/deals/${s.deal_id}`}
                    className="block px-6 py-3 hover:bg-accent/30"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{s.contact_name ?? s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.stage_name} · {s.days_stale}d quiet
                        </div>
                      </div>
                      <div className="shrink-0 text-xs">
                        {formatMoney(s.amount_cents ?? 0, ctx.org.currency)}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border bg-card">
        <header className="border-b px-6 py-4">
          <h2 className="font-semibold">Lost-deal reasons</h2>
          <p className="text-xs text-muted-foreground">{label}</p>
        </header>
        {(lost ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No lost deals this window.</p>
        ) : (
          <ul className="divide-y text-sm">
            {(lost ?? []).map((l: LostRow, i: number) => (
              <li key={i} className="flex items-center justify-between px-6 py-3">
                <div className="font-medium">{l.lost_reason}</div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-muted-foreground">{l.count} deals</span>
                  <span className="font-medium">
                    {formatMoney(l.total_cents ?? 0, ctx.org.currency)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type ScorecardRow = {
  owner_id: string | null;
  full_name: string | null;
  role: string | null;
  booked_cents: number | null;
  pipeline_cents: number | null;
  open_deal_count: number | null;
  won_deal_count: number | null;
  lost_deal_count: number | null;
  lead_to_won_pct: number | null;
  avg_response_minutes: number | null;
  unanswered_leads: number | null;
};

type FunnelRow = {
  stage_id: string;
  stage_name: string;
  deals_created: number;
  deals_reached: number;
  pipeline_cents: number | null;
};

type LostRow = { lost_reason: string; count: number; total_cents: number | null };
type UnansweredRow = {
  deal_id: string;
  title: string;
  minutes_waiting: number | null;
  contact_name: string | null;
};
type StaleRow = {
  deal_id: string;
  title: string;
  stage_name: string;
  days_stale: number;
  amount_cents: number | null;
  contact_name: string | null;
};

function Stat({
  label,
  value,
  hint,
  Icon,
  band,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  Icon: typeof DollarSign;
  band?: string;
  tone?: 'warn';
}) {
  const bandStyle = band ? BAND_STYLES[band] : null;
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`mt-2 text-3xl font-bold ${tone === 'warn' ? 'text-destructive' : ''}`}>
        {value}
      </div>
      {hint ? (
        <div
          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs ${
            bandStyle?.classes ?? 'text-muted-foreground'
          }`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Bar({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'ok' | 'warn' | 'bad';
}) {
  const pct = total > 0 ? Math.round((100 * count) / total) : 0;
  const color =
    tone === 'ok' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-destructive';
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">
          {count} <span className="text-muted-foreground">· {pct}%</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function RangePicker({ active }: { active: RangeKey }) {
  const opts: { key: RangeKey; label: string }[] = [
    { key: 'wtd', label: 'WTD' },
    { key: 'mtd', label: 'MTD' },
    { key: 'qtd', label: 'QTD' },
    { key: 'ytd', label: 'YTD' },
  ];
  return (
    <div className="flex rounded-md border bg-card p-0.5 text-sm">
      {opts.map((o) => (
        <Link
          key={o.key}
          href={`/app/scoreboard?range=${o.key}`}
          className={`rounded px-3 py-1 ${
            active === o.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}
