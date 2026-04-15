import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { QuoteBuilder, type InquiryPrefill } from '../quote-builder';

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams?: Promise<{ deal?: string }>;
}) {
  const ctx = await requireCurrent();
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const [{ data: contacts }, { data: menuItems }, { data: openDeals }, { data: locations }] =
    await Promise.all([
      supabase.from('contacts').select('id, first_name, last_name').order('last_name').limit(500),
      supabase
        .from('menu_items')
        .select('id, name, description, unit_price_cents, unit')
        .eq('is_active', true)
        .order('name')
        .limit(500),
      supabase
        .from('deals')
        .select(
          'id, title, contact_id, amount_cents, expected_close_date, custom_fields, contacts:contact_id (first_name, last_name, email)',
        )
        .is('closed_at', null)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('locations').select('id, name').order('name'),
    ]);

  // If ?deal=<uuid>, prefill from that deal
  let prefill: InquiryPrefill | null = null;
  if (sp.deal) {
    const match = openDeals?.find((d) => d.id === sp.deal);
    if (match) {
      const cf = (match.custom_fields ?? {}) as Record<string, unknown>;
      const eventDate = match.expected_close_date
        ? new Date(match.expected_close_date).toISOString().slice(0, 10)
        : '';
      prefill = {
        deal_id: match.id,
        contact_id: match.contact_id,
        event_date: eventDate,
        headcount: Number(cf.headcount ?? 0) || 0,
        service_type: (cf.service_type_raw as string) || (cf.service_type as string) || '',
        location_id: (cf.location_id as string) || '',
      };
    }
  }

  const dealOptions = (openDeals ?? []).map((d) => {
    const contactRaw = Array.isArray(d.contacts) ? d.contacts[0] : d.contacts;
    const contact = contactRaw as
      | { first_name: string | null; last_name: string | null; email: string | null }
      | null;
    const who = contact
      ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.email
      : '';
    return {
      id: d.id,
      label: d.title,
      subtitle: [
        who,
        d.expected_close_date
          ? new Date(d.expected_close_date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : null,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  });

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href="/app/quotes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>
      <PageHeader
        title="New quote"
        description="Tie this quote to an existing inquiry to pre-fill event details."
      />
      <QuoteBuilder
        currency={ctx.org.currency}
        contacts={(contacts ?? []).map((c) => ({
          id: c.id,
          label: [c.first_name, c.last_name].filter(Boolean).join(' ') || '(no name)',
        }))}
        menuItems={(menuItems ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description ?? null,
          unit_price_cents: m.unit_price_cents,
          unit: m.unit,
        }))}
        deals={dealOptions}
        locations={locations ?? []}
        prefill={prefill}
      />
    </div>
  );
}
