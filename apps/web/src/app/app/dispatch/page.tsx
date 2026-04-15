import Link from 'next/link';
import { Truck, MapPin, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge, eventStatusTone } from '@/components/ui/status-badge';

export default async function DispatchPage() {
  await requireCurrent();
  const supabase = await createClient();
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 14);

  const { data: events } = await supabase
    .from('events')
    .select('id, name, status, service_type, headcount, starts_at, venue_name, venue_address')
    .gte('starts_at', today.toISOString())
    .lt('starts_at', end.toISOString())
    .in('service_type', ['delivery', 'drop_off', 'full_service'])
    .order('starts_at');

  // group by day
  const byDay = new Map<string, typeof events>();
  for (const e of events ?? []) {
    const day = new Date(e.starts_at).toDateString();
    byDay.set(day, [...((byDay.get(day) ?? []) as NonNullable<typeof events>), e]);
  }

  return (
    <div className="container py-8">
      <PageHeader
        title="Dispatch"
        description="Delivery and full-service events for the next 14 days."
      />

      {byDay.size === 0 ? (
        <EmptyState
          icon={Truck}
          title="No dispatch in the next 14 days"
          description="Events that require delivery or full service will appear here when scheduled."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(byDay.entries()).map(([day, dayEvents]) => (
            <section key={day}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {new Date(day).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <div className="overflow-hidden rounded-lg border bg-card">
                <ul className="divide-y">
                  {(dayEvents ?? []).map((e) => (
                    <li key={e.id} className="p-4 hover:bg-accent/30">
                      <Link href={`/app/events/${e.id}`} className="flex items-start gap-4">
                        <div className="w-24 shrink-0 text-sm">
                          <div className="flex items-center gap-1 font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            {new Date(e.starts_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="mt-0.5 text-xs capitalize text-muted-foreground">
                            {e.service_type.replace('_', ' ')}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{e.name}</span>
                            <StatusBadge label={e.status} tone={eventStatusTone(e.status)} />
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {e.venue_name ?? 'No venue'}{' '}
                            {e.venue_address ? `· ${e.venue_address}` : ''}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {e.headcount} guests
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
