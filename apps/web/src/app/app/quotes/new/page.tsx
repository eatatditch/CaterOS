import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { QuoteBuilder, type InquiryPrefill, type MenuItemForQuote } from '../quote-builder';

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams?: Promise<{ deal?: string }>;
}) {
  const ctx = await requireCurrent();
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const [
    { data: contacts },
    { data: menuItems },
    { data: itemGroupLinks },
    { data: groups },
    { data: modifiers },
    { data: openDeals },
    { data: locations },
  ] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name').order('last_name').limit(500),
    supabase
      .from('menu_items')
      .select('id, name, description, unit_price_cents, unit, category_id')
      .eq('is_active', true)
      .order('name')
      .limit(500),
    supabase
      .from('menu_item_modifier_groups')
      .select('menu_item_id, modifier_group_id, position'),
    supabase
      .from('modifier_groups')
      .select('id, name, is_required, min_selections, max_selections'),
    supabase
      .from('modifiers')
      .select('id, group_id, name, price_delta_cents, position')
      .order('position'),
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

  // Build group-to-modifiers map
  const groupToMods = new Map<string, { id: string; name: string; price_delta_cents: number }[]>();
  for (const m of modifiers ?? []) {
    const list = groupToMods.get(m.group_id) ?? [];
    list.push({ id: m.id, name: m.name, price_delta_cents: m.price_delta_cents });
    groupToMods.set(m.group_id, list);
  }

  // Build group lookup
  const groupById = new Map<string, { id: string; name: string; is_required: boolean; min_selections: number; max_selections: number }>();
  for (const g of groups ?? []) groupById.set(g.id, g);

  // Build item-to-groups map
  const itemToGroups = new Map<string, { group: ReturnType<typeof groupById.get>; position: number }[]>();
  for (const link of itemGroupLinks ?? []) {
    const g = groupById.get(link.modifier_group_id);
    if (!g) continue;
    const list = itemToGroups.get(link.menu_item_id) ?? [];
    list.push({ group: g, position: link.position });
    itemToGroups.set(link.menu_item_id, list);
  }

  // Assemble the menu item shape for the quote builder
  const itemsForBuilder: MenuItemForQuote[] = (menuItems ?? []).map((m) => {
    const linkedGroups = (itemToGroups.get(m.id) ?? [])
      .sort((a, b) => a.position - b.position)
      .map(({ group }) => ({
        group_id: group!.id,
        name: group!.name,
        is_required: group!.is_required,
        min_selections: group!.min_selections,
        max_selections: group!.max_selections,
        options: groupToMods.get(group!.id) ?? [],
      }));
    return {
      id: m.id,
      name: m.name,
      description: m.description ?? null,
      unit_price_cents: m.unit_price_cents,
      unit: m.unit,
      modifier_groups: linkedGroups,
    };
  });

  // ?deal=<uuid> prefill
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
        menuItems={itemsForBuilder}
        deals={dealOptions}
        locations={locations ?? []}
        prefill={prefill}
      />
    </div>
  );
}
