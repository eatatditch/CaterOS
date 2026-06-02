import Link from 'next/link';
import { Truck, MapPin, Clock, Users, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { hasRole } from '@cateros/lib/auth';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { DeleteEventButton } from '@/components/delete-event-button';
import { DriverSelect, StatusSelect, type DriverOption } from './dispatch-controls';
import { MyDeliveriesToggle } from './my-deliveries-toggle';
import { type DispatchStatus } from '@/lib/actions/dispatch';

const DISPATCH_LABELS: Record<DispatchStatus, string> = {
  unassigned: 'Unassigned',
  assigned: 'Assigned',
  en_route: 'En route',
  arrived: 'Arrived',
  delivered: 'Delivered',
  completed: 'Completed',
};

function dispatchTone(status: string) {
  switch (status) {
    case 'unassigned':
      return 'gray' as const;
    case 'assigned':
      return 'blue' as const;
    case 'en_route':
      return 'yellow' as const;
    case 'arrived':
      return 'orange' as const;
    case 'delivered':
    case 'completed':
      return 'green' as const;
    default:
      return 'gray' as const;
  }
}

type DispatchEvent = {
  id: string;
  name: string;
  service_type: string;
  headcount: number;
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  dispatch_status: DispatchStatus;
  driver_id: string | null;
  contact: { first_name: string | null; last_name: string | null } | null;
};

export default async function DispatchPage({
  searchParams,
}: {
  searchParams?: Promise<{ mine?: string }>;
}) {
  const ctx = await requireCurrent();
  const params = (await searchParams) ?? {};
  const mineOnly = params.mine === '1';
  const canAssign = hasRole(ctx.role, 'ops');

  const supabase = await createClient();
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 14);

  let query = supabase
    .from('events')
    .select(
      'id, name, service_type, headcount, starts_at, venue_name, venue_address, dispatch_status, driver_id, contact:contacts(first_name, last_name)',
    )
    .gte('starts_at', today.toISOString())
    .lt('starts_at', end.toISOString())
    .in('service_type', ['delivery', 'drop_off', 'full_service'])
    .order('starts_at');

  if (mineOnly) query = query.eq('driver_id', ctx.user.id);

  const { data } = await query;
  const events = (data ?? []) as unknown as DispatchEvent[];

  // Org members who can be dispatched: drivers + ops (and above).
  const { data: members } = await supabase
    .from('memberships')
    .select('user_id, role, profile:profiles(full_name)')
    .eq('org_id', ctx.org.id)
    .in('role', ['driver', 'ops', 'manager', 'owner']);

  const drivers: DriverOption[] = (members ?? [])
    .map((m) => {
      const profile = m.profile as unknown as { full_name: string | null } | null;
      return {
        id: m.user_id as string,
        name: profile?.full_name ?? 'Unnamed member',
        role: m.role as string,
      };
    })
    // Prioritize drivers in the list, then ops/managers/owners.
    .sort((a, b) => (a.role === 'driver' ? -1 : 1) - (b.role === 'driver' ? -1 : 1));

  // group by day
  const byDay = new Map<string, DispatchEvent[]>();
  for (const e of events) {
    const day = new Date(e.starts_at).toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }

  return (
    <div className="container py-8">
      <PageHeader
        title="Dispatch"
        description="Assign drivers and track delivery status for the next 14 days."
        actions={<MyDeliveriesToggle />}
      />

      {byDay.size === 0 ? (
        <EmptyState
          icon={Truck}
          title={mineOnly ? 'No deliveries assigned to you' : 'No dispatch in the next 14 days'}
          description={
            mineOnly
              ? 'Deliveries assigned to you will appear here.'
              : 'Events that require delivery or full service will appear here when scheduled.'
          }
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
                  {dayEvents.map((e) => {
                    const contactName = e.contact
                      ? [e.contact.first_name, e.contact.last_name].filter(Boolean).join(' ')
                      : '';
                    const canEditStatus = canAssign || e.driver_id === ctx.user.id;
                    return (
                      <li key={e.id} className="flex flex-col gap-3 p-4 hover:bg-accent/30">
                        <div className="flex items-start gap-2">
                          <Link
                            href={`/app/events/${e.id}`}
                            className="flex flex-1 items-start gap-4"
                          >
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
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{e.name}</span>
                                <StatusBadge
                                  label={DISPATCH_LABELS[e.dispatch_status] ?? e.dispatch_status}
                                  tone={dispatchTone(e.dispatch_status)}
                                />
                              </div>
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" />
                                {e.venue_name ?? 'No venue'}{' '}
                                {e.venue_address ? `· ${e.venue_address}` : ''}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3.5 w-3.5" />
                                  {e.headcount} guests
                                </span>
                                {contactName ? (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3.5 w-3.5" />
                                    {contactName}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </Link>
                          <DeleteEventButton eventId={e.id} eventName={e.name} variant="icon" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 pl-0 sm:pl-28">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">
                              Driver
                            </span>
                            <DriverSelect
                              eventId={e.id}
                              driverId={e.driver_id}
                              drivers={drivers}
                              canAssign={canAssign}
                            />
                          </div>
                          {canEditStatus ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                Status
                              </span>
                              <StatusSelect
                                eventId={e.id}
                                status={e.dispatch_status}
                                canEdit={canEditStatus}
                              />
                            </div>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
