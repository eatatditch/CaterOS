import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Flame,
  Snowflake,
} from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';

export const dynamic = 'force-dynamic';

export default async function MyPipelinePage() {
  const ctx = await requirePermission('deals.manage');
  const supabase = await createClient();
  const metrics = supabase.schema('metrics' as never);

  // Week-to-date window for the goal panel
  const to = new Date();
  const weekStart = new Date(to);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - ((day + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);

  const [
    { data: hot },
    { data: stale },
    { data: unanswered },
    { data: prospects },
    { data: revenue },
    { data: coverage },
    { data: activity },
    { data: recentActivities },
  ] = await Promise.all([
    metrics.rpc('hot_leads', { p_org: ctx.org.id, p_owner: ctx.user.id, p_limit: 8 }),
    metrics.rpc('stale_leads', { p_org: ctx.org.id, p_days: 7, p_owner: ctx.user.id }),
    metrics.rpc('unanswered_leads', { p_org: ctx.org.id, p_owner: ctx.user.id }),
    metrics.rpc('prospect_queue', { p_org: ctx.org.id, p_owner: ctx.user.id }),
    metrics
      .rpc('revenue_summary', {
        p_org: ctx.org.id,
        p_from: weekStart.toISOString(),
        p_to: to.toISOString(),
        p_owner: ctx.user.id,
      })
      .single(),
    metrics
      .rpc('coverage_ratio', {
        p_org: ctx.org.id,
        p_as_of: to.toISOString(),
        p_owner: ctx.user.id,
        p_period: 'weekly',
      })
      .single(),
    metrics.rpc('activity_counts', {
      p_org: ctx.org.id,
      p_from: weekStart.toISOString(),
      p_to: to.toISOString(),
      p_owner: ctx.user.id,
    }),
    supabase
      .from('activities')
      .select('id, type, subject, body, created_at, deal_id, prospect_id')
      .eq('owner_id', ctx.user.id)
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const r = (revenue ?? {}) as { booked_cents?: number; pipeline_cents?: number };
  const c = (coverage ?? {}) as {
    revenue_goal_cents?: number;
    remaining_goal_cents?: number;
    ratio?: number;
  };
  const a = ((activity ?? [])[0] ?? {}) as {
    outbound?: number;
    tastings?: number;
    site_visits?: number;
    follow_ups?: number;
  };

  return (
    <div className="container py-8">
      <PageHeader
        title="My pipeline"
        description="What needs your attention today."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Booked this week"
          value={formatMoney(r.booked_cents ?? 0, ctx.org.currency)}
          hint={
            c.revenue_goal_cents && c.revenue_goal_cents > 0
              ? `Goal ${formatMoney(c.revenue_goal_cents, ctx.org.currency)}`
              : 'No weekly goal set'
          }
        />
        <Stat
          label="My open pipeline"
          value={formatMoney(r.pipeline_cents ?? 0, ctx.org.currency)}
          hint={
            c.ratio != null ? `${c.ratio.toFixed(1)}x coverage` : 'No goal set'
          }
        />
        <Stat
          label="Outbound this week"
          value={String(a.outbound ?? 0)}
          hint="Calls + emails + SMS"
        />
        <Stat
          label="Tastings + site visits"
          value={String((a.tastings ?? 0) + (a.site_visits ?? 0))}
          hint={`${a.tastings ?? 0} tastings · ${a.site_visits ?? 0} site visits`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Unanswered leads"
          subtitle="SLA: respond within 4h"
          icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
          empty={
            <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Inbox clear.
            </p>
          }
          items={(unanswered ?? []).slice(0, 8).map((u: UnansweredRow) => ({
            href: `/app/deals/${u.deal_id}`,
            key: u.deal_id,
            title: u.contact_name ?? u.title,
            meta: `${formatDuration(u.minutes_waiting ?? 0)} waiting`,
            badge: (u.minutes_waiting ?? 0) > 1440 ? 'RED' : 'YELLOW',
            badgeTone: ((u.minutes_waiting ?? 0) > 1440 ? 'red' : 'yellow') as 'red' | 'yellow',
          }))}
        />

        <Section
          title="Hot leads"
          subtitle="High weighted value"
          icon={<Flame className="h-4 w-4 text-amber-600" />}
          empty={<p className="p-6 text-sm text-muted-foreground">Nothing hot right now.</p>}
          items={(hot ?? []).map((h: HotRow) => ({
            href: `/app/deals/${h.deal_id}`,
            key: h.deal_id,
            title: h.contact_name ?? h.title,
            meta: `${h.stage_name} · ${formatMoney(h.weighted_cents ?? 0, ctx.org.currency)} weighted`,
            badge: formatMoney(h.amount_cents ?? 0, ctx.org.currency),
            badgeTone: 'plain' as const,
          }))}
        />

        <Section
          title="Stale deals"
          subtitle="No touch in 7+ days"
          icon={<Snowflake className="h-4 w-4 text-sky-600" />}
          empty={<p className="p-6 text-sm text-muted-foreground">Nothing stale.</p>}
          items={(stale ?? []).slice(0, 8).map((s: StaleRow) => ({
            href: `/app/deals/${s.deal_id}`,
            key: s.deal_id,
            title: s.contact_name ?? s.title,
            meta: `${s.stage_name} · ${s.days_stale}d quiet`,
            badge: formatMoney(s.amount_cents ?? 0, ctx.org.currency),
            badgeTone: 'plain' as const,
          }))}
        />

        <Section
          title="Outbound queue"
          subtitle="Prospects due for next touch"
          icon={<Compass className="h-4 w-4 text-muted-foreground" />}
          empty={
            <p className="p-6 text-sm text-muted-foreground">
              No prospects queued.{' '}
              <Link href="/app/prospects" className="text-primary hover:underline">
                Add some
              </Link>
              .
            </p>
          }
          items={(prospects ?? []).slice(0, 8).map((p: ProspectRow) => ({
            href: `/app/prospects/${p.prospect_id}`,
            key: p.prospect_id,
            title: p.company_name,
            meta: p.next_touch_at
              ? p.days_until_touch != null && p.days_until_touch < 0
                ? `${Math.abs(p.days_until_touch).toFixed(1)}d overdue`
                : `Due ${new Date(p.next_touch_at).toLocaleDateString()}`
              : 'No next touch scheduled',
            badge: p.segment.replace('_', ' '),
            badgeTone: 'plain' as const,
          }))}
        />
      </div>

      <section className="mt-6 rounded-lg border bg-card">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-semibold">Recent activity</h2>
            <p className="text-xs text-muted-foreground">Last 14 days</p>
          </div>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </header>
        {(recentActivities ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No activity logged yet. Open any deal to log a call, email, tasting, or site visit.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {(recentActivities ?? []).map((act) => (
              <li key={act.id} className="px-6 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">
                      <span className="mr-2 text-xs uppercase tracking-wider text-muted-foreground">
                        {act.type.replace('_', ' ')}
                      </span>
                      {act.subject ?? '(no subject)'}
                    </div>
                    {act.body ? (
                      <div className="truncate text-xs text-muted-foreground">{act.body}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type UnansweredRow = {
  deal_id: string;
  title: string;
  contact_name: string | null;
  minutes_waiting: number | null;
};
type HotRow = {
  deal_id: string;
  title: string;
  contact_name: string | null;
  stage_name: string;
  weighted_cents: number | null;
  amount_cents: number | null;
};
type StaleRow = {
  deal_id: string;
  title: string;
  contact_name: string | null;
  stage_name: string;
  days_stale: number;
  amount_cents: number | null;
};
type ProspectRow = {
  prospect_id: string;
  company_name: string;
  segment: string;
  next_touch_at: string | null;
  days_until_touch: number | null;
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  items,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: {
    key: string;
    href: string;
    title: string;
    meta: string;
    badge?: string;
    badgeTone: 'red' | 'yellow' | 'plain';
  }[];
  empty: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {icon}
      </header>
      {items.length === 0 ? (
        empty
      ) : (
        <ul className="divide-y text-sm">
          {items.map((it) => (
            <li key={it.key}>
              <Link
                href={it.href}
                className="flex items-start justify-between gap-3 px-6 py-3 hover:bg-accent/30"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.title}</div>
                  <div className="text-xs text-muted-foreground">{it.meta}</div>
                </div>
                {it.badge ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      it.badgeTone === 'red'
                        ? 'bg-destructive/10 text-destructive'
                        : it.badgeTone === 'yellow'
                          ? 'bg-amber-500/10 text-amber-700'
                          : 'text-muted-foreground'
                    }`}
                  >
                    {it.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(1)}h`;
  return `${(minutes / 1440).toFixed(1)}d`;
}
