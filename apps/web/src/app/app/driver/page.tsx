import { Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PWARegister } from '@/components/pwa-register';
import { DeliveryCard, type Delivery } from './delivery-card';
import { InstallButton } from './install-button';
import type { DispatchStatus } from '@/lib/dispatch/statuses';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  name: string;
  service_type: string;
  headcount: number | null;
  starts_at: string;
  venue_name: string | null;
  venue_address: string | null;
  dispatch_status: DispatchStatus;
  contact: { first_name: string | null; last_name: string | null; phone: string | null } | null;
};

export default async function DriverPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 14);

  // The signed-in user's own delivery queue (assigned to them), still open.
  const { data } = await supabase
    .from('events')
    .select(
      'id, name, service_type, headcount, starts_at, venue_name, venue_address, dispatch_status, driver_id, contact:contacts(first_name, last_name, phone)',
    )
    .eq('driver_id', ctx.user.id)
    .gte('starts_at', today.toISOString())
    .lt('starts_at', end.toISOString())
    .neq('dispatch_status', 'completed')
    .order('starts_at');

  const rows = (data ?? []) as unknown as Row[];
  const deliveries: Delivery[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    serviceType: r.service_type,
    startsAt: r.starts_at,
    venueName: r.venue_name,
    venueAddress: r.venue_address,
    headcount: r.headcount,
    contactName: r.contact
      ? [r.contact.first_name, r.contact.last_name].filter(Boolean).join(' ')
      : '',
    contactPhone: r.contact?.phone ?? null,
    status: r.dispatch_status,
  }));

  // Group by day for a scannable run-sheet.
  const byDay = new Map<string, Delivery[]>();
  for (const d of deliveries) {
    const day = new Date(d.startsAt).toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), d]);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <PWARegister />
      <PageHeader
        title="My deliveries"
        description="Your assigned runs. Works offline — updates sync when you reconnect."
        actions={<InstallButton />}
      />

      {byDay.size === 0 ? (
        <EmptyState
          icon={Truck}
          title="No deliveries assigned to you"
          description="When a dispatcher assigns you a delivery, it'll show up here."
        />
      ) : (
        <div className="space-y-6">
          {Array.from(byDay.entries()).map(([day, items]) => (
            <section key={day} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {new Date(day).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </h2>
              {items.map((d) => (
                <DeliveryCard key={d.id} delivery={d} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
