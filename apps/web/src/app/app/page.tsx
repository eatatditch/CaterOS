import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import {
  Calendar,
  ClipboardList,
  CreditCard,
  Inbox,
  Users,
} from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { StatusBadge, eventStatusTone } from '@/components/ui/status-badge';

export default async function DashboardPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Find the default pipeline's Lead stage id so we can fetch new inquiries
  const { data: leadStage } = await supabase
    .from('stages')
    .select('id')
    .eq('name', 'Lead')
    .limit(1)
    .maybeSingle();

  const [
    { count: openQuotes },
    { count: upcomingEvents },
    { count: contactCount },
    { data: revenueRows },
    { data: upcoming },
    { data: newInquiries },
  ] = await Promise.all([
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'sent', 'viewed']),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('starts_at', now.toISOString())
      .lt('starts_at', in30.toISOString())
      .in('status', ['confirmed', 'in_prep', 'in_progress']),
    supabase.from('contacts').select('id', { count: 'exact', head: true }),
    supabase
      .from('quotes')
      .select('total_cents')
      .in('status', ['accepted', 'converted'])
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('events')
      .select('id, name, status, starts_at, headcount, venue_name')
      .gte('starts_at', now.toISOString())
      .in('status', ['confirmed', 'in_prep', 'in_progress'])
      .order('starts_at')
      .limit(5),
    leadStage
      ? supabase
          .from('deals')
          .select(
            'id, title, amount_cents, currency, created_at, expected_close_date, contact_id, contacts:contact_id (first_name, last_name, email, phone)',
          )
          .eq('stage_id', leadStage.id)
          .is('closed_at', null)
          .order('created_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const bookedMtd = revenueRows?.reduce((sum, r) => sum + (r.total_cents ?? 0), 0) ?? 0;

  // Figure out which lead deals don't yet have an outbound activity (call/email/meeting)
  const inquiryIds = (newInquiries ?? []).map((d) => d.id);
  let respondedIds = new Set<string>();
  if (inquiryIds.length > 0) {
    const { data: replies } = await supabase
      .from('activities')
      .select('deal_id')
      .in('deal_id', inquiryIds)
      .in('type', ['call', 'email', 'meeting', 'sms']);
    respondedIds = new Set((replies ?? []).map((r) => r.deal_id as string));
  }
  const unansweredCount = inquiryIds.filter((id) => !respondedIds.has(id)).length;

  const stats = [
    {
      label: 'New inquiries',
      value: String(newInquiries?.length ?? 0),
      icon: Inbox,
      href: '/app/pipeline',
      highlight: unansweredCount > 0 ? `${unansweredCount} unanswered` : undefined,
    },
    {
      label: 'Open quotes',
      value: String(openQuotes ?? 0),
      icon: ClipboardList,
      href: '/app/quotes',
    },
    {
      label: 'Upcoming events',
      value: String(upcomingEvents ?? 0),
      icon: Calendar,
      href: '/app/events',
      hint: 'Confirmed, next 30d',
    },
    {
      label: 'Booked this month',
      value: formatMoney(bookedMtd, ctx.org.currency),
      icon: CreditCard,
      href: '/app/quotes',
    },
  ];

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back, {ctx.user.email}. Here&apos;s your business at a glance.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, highlight, hint }) => (
          <Link
            key={label}
            href={href}
            className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
            {highlight ? (
              <div className="mt-1 text-xs font-medium text-destructive">{highlight}</div>
            ) : hint ? (
              <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
            ) : null}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* New inquiries / unanswered leads */}
        <div className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="font-semibold">New inquiries</h2>
              <p className="text-xs text-muted-foreground">
                Inbound leads waiting for a response
              </p>
            </div>
            <Users className="h-4 w-4 text-muted-foreground" />
          </header>
          {newInquiries && newInquiries.length > 0 ? (
            <ul className="divide-y">
              {newInquiries.map((d) => {
                const contactRaw = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts;
                const contact = contactRaw as
                  | {
                      first_name: string | null;
                      last_name: string | null;
                      email: string | null;
                      phone: string | null;
                    }
                  | null;
                const name = contact
                  ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
                  : 'Unknown';
                const responded = respondedIds.has(d.id);
                return (
                  <li key={d.id}>
                    <Link
                      href={`/app/deals/${d.id}`}
                      className="flex items-start justify-between gap-4 p-4 hover:bg-accent/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{name || d.title}</span>
                          {!responded ? (
                            <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                              Unanswered
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {contact?.email ?? contact?.phone ?? d.title}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}
                          {d.expected_close_date
                            ? ` · event ${new Date(d.expected_close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                            : ''}
                        </div>
                      </div>
                      {d.amount_cents > 0 ? (
                        <div className="shrink-0 text-sm font-medium">
                          {formatMoney(d.amount_cents, d.currency)}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              No new leads. When someone submits your{' '}
              <Link href="/app/marketing/forms" className="text-primary hover:underline">
                web form
              </Link>{' '}
              they&apos;ll show up here.
            </p>
          )}
        </div>

        {/* Upcoming confirmed events */}
        <div className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="font-semibold">Upcoming events</h2>
              <p className="text-xs text-muted-foreground">Confirmed and in-progress</p>
            </div>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </header>
          {upcoming && upcoming.length > 0 ? (
            <ul className="divide-y">
              {upcoming.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/app/events/${e.id}`}
                    className="flex items-center justify-between p-4 hover:bg-accent/30"
                  >
                    <div>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(e.starts_at).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {e.venue_name ? ` · ${e.venue_name}` : ''} · {e.headcount} guests
                      </div>
                    </div>
                    <StatusBadge label={e.status} tone={eventStatusTone(e.status)} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              No confirmed events yet.{' '}
              <Link href="/app/events/new" className="text-primary hover:underline">
                Create one
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
