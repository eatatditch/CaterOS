import Link from 'next/link';
import { Calendar, ClipboardList, CreditCard, Users } from 'lucide-react';
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

  const [
    { count: openQuotes },
    { count: upcomingEvents },
    { count: contactCount },
    { data: revenueRows },
    { data: upcoming },
  ] = await Promise.all([
    supabase
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .in('status', ['draft', 'sent', 'viewed']),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .gte('starts_at', now.toISOString())
      .lt('starts_at', in30.toISOString()),
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
      .order('starts_at')
      .limit(5),
  ]);

  const bookedMtd =
    revenueRows?.reduce((sum, r) => sum + (r.total_cents ?? 0), 0) ?? 0;

  const stats = [
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
    },
    {
      label: 'Active contacts',
      value: String(contactCount ?? 0),
      icon: Users,
      href: '/app/contacts',
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
        {stats.map(({ label, value, icon: Icon, href }) => (
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
          </Link>
        ))}
      </div>

      <div className="rounded-lg border bg-card">
        <header className="border-b px-6 py-4">
          <h2 className="font-semibold">Next 5 events</h2>
        </header>
        {upcoming && upcoming.length > 0 ? (
          <ul className="divide-y">
            {upcoming.map((e) => (
              <li key={e.id}>
                <Link href={`/app/events/${e.id}`} className="flex items-center justify-between p-4 hover:bg-accent/30">
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
                      {e.venue_name ? ` · ${e.venue_name}` : ''} · {e.headcount} pax
                    </div>
                  </div>
                  <StatusBadge label={e.status} tone={eventStatusTone(e.status)} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            No upcoming events. <Link href="/app/events/new" className="text-primary hover:underline">Create one</Link> to get started.
          </p>
        )}
      </div>
    </div>
  );
}
