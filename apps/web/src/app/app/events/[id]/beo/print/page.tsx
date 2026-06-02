import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PrintButton } from './print-button';

// Print-optimized BEO view. The user opens this in a new tab and prints to PDF
// from the browser. Section order/labels mirror the BEO builder (beo-section.tsx).
const SECTIONS: { key: string; label: string }[] = [
  { key: 'timeline', label: 'Timeline / Run-of-show' },
  { key: 'kitchen_notes', label: 'Kitchen notes' },
  { key: 'service_notes', label: 'Service / front-of-house notes' },
  { key: 'setup_instructions', label: 'Setup instructions' },
  { key: 'equipment', label: 'Equipment & rentals' },
  { key: 'staffing_notes', label: 'Staffing' },
  { key: 'dietary_allergens', label: 'Dietary & allergens' },
  { key: 'special_requests', label: 'Special requests' },
];

function fmt(value: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', opts);
}

export default async function BeoPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ beo?: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const { beo: beoId } = await searchParams;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select(
      'id, name, status, headcount, service_type, starts_at, ends_at, setup_at, venue_name, venue_address, org_id, quote_id',
    )
    .eq('id', id)
    .maybeSingle();
  if (!event) notFound();

  // Pick the requested BEO, else the most recent finalized one, else the latest.
  const { data: beos } = await supabase
    .from('beos')
    .select('id, version, title, status, notes, content, generated_at, finalized_at')
    .eq('event_id', id)
    .order('version', { ascending: false });

  const list = beos ?? [];
  const beo =
    (beoId ? list.find((b) => b.id === beoId) : undefined) ??
    list.find((b) => b.status === 'final') ??
    list[0] ??
    null;

  const { data: org } = await supabase
    .from('orgs')
    .select('name')
    .eq('id', event.org_id)
    .maybeSingle();

  const { data: quoteItems } = event.quote_id
    ? await supabase
        .from('quote_items')
        .select('name, quantity')
        .eq('quote_id', event.quote_id)
        .order('position')
    : { data: [] as { name: string; quantity: number }[] };

  const content = (beo?.content ?? {}) as Record<string, string>;

  return (
    <div className="beo-print mx-auto max-w-3xl bg-white p-10 text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff; }
          @page { margin: 0.75in; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between border-b pb-4">
        <span className="text-sm text-gray-500">Print preview — use your browser to save as PDF.</span>
        <PrintButton />
      </div>

      <header className="mb-6 border-b border-gray-300 pb-4">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          {org?.name ?? 'Banquet Event Order'}
        </div>
        <h1 className="mt-1 text-2xl font-bold">{beo?.title || event.name}</h1>
        <div className="mt-1 text-sm text-gray-600">
          {event.name}
          {beo ? ` · BEO v${beo.version}${beo.status === 'final' ? ' (final)' : ' (draft)'}` : ''}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="font-semibold">Date / time: </span>
          {fmt(event.starts_at, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
          {' – '}
          {fmt(event.ends_at, { hour: 'numeric', minute: '2-digit' })}
        </div>
        <div>
          <span className="font-semibold">Guests: </span>
          {event.headcount}
        </div>
        <div>
          <span className="font-semibold">Service: </span>
          <span className="capitalize">{String(event.service_type).replace('_', ' ')}</span>
        </div>
        <div>
          <span className="font-semibold">Setup: </span>
          {fmt(event.setup_at, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
        </div>
        <div className="col-span-2">
          <span className="font-semibold">Venue: </span>
          {event.venue_name ?? '—'}
          {event.venue_address ? ` — ${event.venue_address}` : ''}
        </div>
      </section>

      {quoteItems && quoteItems.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
            Menu
          </h2>
          <ul className="space-y-1 text-sm">
            {quoteItems.map((qi, i) => (
              <li key={i}>
                {qi.quantity}× {qi.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {beo ? (
        SECTIONS.map((s) =>
          content[s.key]?.trim() ? (
            <section key={s.key} className="mb-5">
              <h2 className="mb-1 border-b border-gray-300 pb-1 text-sm font-bold uppercase tracking-wide">
                {s.label}
              </h2>
              <p className="whitespace-pre-wrap text-sm">{content[s.key]}</p>
            </section>
          ) : null,
        )
      ) : (
        <p className="text-sm text-gray-500">No BEO has been created for this event yet.</p>
      )}

      {beo?.finalized_at ? (
        <footer className="mt-8 border-t border-gray-300 pt-3 text-xs text-gray-500">
          Finalized {fmt(beo.finalized_at, { month: 'long', day: 'numeric', year: 'numeric' })}
        </footer>
      ) : null}
    </div>
  );
}
