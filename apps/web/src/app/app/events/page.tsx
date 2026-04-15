import Link from 'next/link';
import { Calendar, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge, eventStatusTone } from '@/components/ui/status-badge';
import { buttonPrimaryCls } from '@/components/ui/field';
import { EventCalendar } from './event-calendar';

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: Promise<{ m?: string }>;
}) {
  await requireCurrent();
  const params = (await searchParams) ?? {};
  const now = new Date();
  const monthStr = params.m ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const parts = monthStr.split('-');
  const year = parseInt(parts[0] ?? '', 10);
  const monthNum = parseInt(parts[1] ?? '', 10);
  const start = new Date(Date.UTC(year, monthNum - 1, 1));
  const end = new Date(Date.UTC(year, monthNum, 1));

  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, name, status, service_type, headcount, starts_at, ends_at, venue_name')
    .gte('starts_at', start.toISOString())
    .lt('starts_at', end.toISOString())
    .order('starts_at');

  const { data: upcoming } = await supabase
    .from('events')
    .select('id, name, status, starts_at, venue_name, headcount')
    .gte('starts_at', now.toISOString())
    .order('starts_at')
    .limit(5);

  return (
    <div className="container py-8">
      <PageHeader
        title="Events"
        description="All upcoming catering events."
        actions={
          <Link href="/app/events/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New event
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <EventCalendar monthStr={monthStr} events={events ?? []} />

        <aside className="space-y-3">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-semibold">Upcoming</h3>
            {upcoming && upcoming.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/app/events/${e.id}`}
                      className="block rounded px-2 py-2 hover:bg-accent"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{e.name}</div>
                        <StatusBadge label={e.status} tone={eventStatusTone(e.status)} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(e.starts_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {e.venue_name ? ` · ${e.venue_name}` : ''} · {e.headcount} guests
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Calendar}
                title="Nothing upcoming"
                description="Your future events will appear here."
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
