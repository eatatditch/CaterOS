import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users, Clock, MapPin } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge, eventStatusTone } from '@/components/ui/status-badge';
import { EventForm } from '../event-form';
import { DeleteEventButton } from '@/components/delete-event-button';
import { BeoSection } from './beo-section';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (!event) notFound();

  const [
    { data: contacts },
    { data: beos },
    { data: quoteItems },
  ] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .order('last_name')
      .limit(500),
    supabase
      .from('beos')
      .select('id, version, title, status, notes, content, generated_at, finalized_at')
      .eq('event_id', id)
      .order('version', { ascending: false }),
    event.quote_id
      ? supabase
          .from('quote_items')
          .select('name, quantity')
          .eq('quote_id', event.quote_id)
          .order('position')
      : Promise.resolve({ data: [] as { name: string; quantity: number }[] }),
  ]);

  const starts = new Date(event.starts_at);
  const ends = new Date(event.ends_at);

  return (
    <div className="container py-8">
      <Link
        href="/app/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>
      <PageHeader
        title={event.name}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge label={event.status} tone={eventStatusTone(event.status)} />
            <DeleteEventButton
              eventId={event.id}
              eventName={event.name}
              afterDelete="go-to-events"
            />
          </div>
        }
      />

      <div className="mb-6 grid gap-3 rounded-lg border bg-card p-6 sm:grid-cols-3">
        <div className="flex items-start gap-2 text-sm">
          <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">
              {starts.toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              until{' '}
              {ends.toLocaleString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <Users className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{event.headcount} guests</div>
            <div className="text-xs text-muted-foreground capitalize">
              {event.service_type.replace('_', ' ')}
            </div>
          </div>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{event.venue_name ?? 'No venue set'}</div>
            <div className="text-xs text-muted-foreground">{event.venue_address ?? ''}</div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <BeoSection
          eventId={event.id}
          beos={(beos ?? []).map((b) => ({
            ...b,
            title: b.title ?? null,
            notes: b.notes ?? null,
            content: (b.content ?? {}) as Record<string, string>,
            finalized_at: b.finalized_at ?? null,
          }))}
          menuItems={(quoteItems ?? []).map((qi) => ({
            name: qi.name,
            quantity: qi.quantity,
          }))}
        />

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 font-semibold">Details</h2>
          <EventForm
            initial={event}
            contacts={(contacts ?? []).map((c) => ({
              id: c.id,
              label: [c.first_name, c.last_name].filter(Boolean).join(' '),
            }))}
          />
        </section>
      </div>
    </div>
  );
}
