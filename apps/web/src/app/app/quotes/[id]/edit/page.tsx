import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import {
  QuoteBuilder,
  type ExistingQuote,
  type MenuItemForQuote,
  type SelectedModifier,
} from '../../quote-builder';

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select(
      'id, status, contact_id, deal_id, headcount, event_date, notes, delivery_fee_cents, discount_cents, deposit_cents, currency, meta',
    )
    .eq('id', id)
    .maybeSingle();
  if (!quote) notFound();
  if (['declined', 'expired', 'converted'].includes(quote.status)) {
    redirect(`/app/quotes/${id}`);
  }

  const [
    { data: items },
    { data: contacts },
    { data: menuItems },
    { data: itemGroupLinks },
    { data: groups },
    { data: modifiers },
    { data: openDeals },
    { data: locations },
  ] = await Promise.all([
    supabase
      .from('quote_items')
      .select('id, menu_item_id, name, description, quantity, unit_price_cents, modifiers, position')
      .eq('quote_id', id)
      .order('position'),
    supabase.from('contacts').select('id, first_name, last_name').order('last_name').limit(500),
    supabase
      .from('menu_items')
      .select('id, name, description, unit_price_cents, unit, category_id')
      .eq('is_active', true)
      .order('name')
      .limit(500),
    supabase.from('menu_item_modifier_groups').select('menu_item_id, modifier_group_id, position'),
    supabase
      .from('modifier_groups')
      .select('id, name, is_required, min_selections, max_selections'),
    supabase
      .from('modifiers')
      .select('id, group_id, name, price_delta_cents, position')
      .order('position'),
    supabase
      .from('deals')
      .select('id, title, contact_id, expected_close_date')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('locations').select('id, name').order('name'),
  ]);

  const groupToMods = new Map<string, { id: string; name: string; price_delta_cents: number }[]>();
  for (const m of modifiers ?? []) {
    const list = groupToMods.get(m.group_id) ?? [];
    list.push({ id: m.id, name: m.name, price_delta_cents: m.price_delta_cents });
    groupToMods.set(m.group_id, list);
  }
  const groupById = new Map<
    string,
    { id: string; name: string; is_required: boolean; min_selections: number; max_selections: number }
  >();
  for (const g of groups ?? []) groupById.set(g.id, g);
  const itemToGroups = new Map<string, { group: ReturnType<typeof groupById.get>; position: number }[]>();
  for (const link of itemGroupLinks ?? []) {
    const g = groupById.get(link.modifier_group_id);
    if (!g) continue;
    const list = itemToGroups.get(link.menu_item_id) ?? [];
    list.push({ group: g, position: link.position });
    itemToGroups.set(link.menu_item_id, list);
  }
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

  const dealOptions = (openDeals ?? []).map((d) => ({
    id: d.id,
    label: d.title,
    subtitle: d.expected_close_date
      ? new Date(d.expected_close_date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : '',
  }));

  const meta = (quote.meta ?? {}) as Record<string, unknown>;
  const existing: ExistingQuote = {
    id: quote.id,
    contact_id: quote.contact_id,
    deal_id: quote.deal_id,
    headcount: quote.headcount,
    event_date: quote.event_date ? new Date(quote.event_date).toISOString().slice(0, 10) : '',
    notes: quote.notes ?? '',
    tax_rate: typeof meta.tax_rate === 'number' ? (meta.tax_rate as number) : 0.0875,
    service_fee_rate:
      typeof meta.service_fee_rate === 'number' ? (meta.service_fee_rate as number) : 0.18,
    delivery_fee_dollars: Number(quote.delivery_fee_cents ?? 0) / 100,
    gratuity_rate: typeof meta.gratuity_rate === 'number' ? (meta.gratuity_rate as number) : 0,
    discount_dollars: Number(quote.discount_cents ?? 0) / 100,
    deposit_dollars: Number(quote.deposit_cents ?? 0) / 100,
    items: (items ?? []).map((it) => ({
      menu_item_id: it.menu_item_id ?? null,
      name: it.name,
      description: it.description ?? '',
      quantity: it.quantity,
      unit_price_cents: it.unit_price_cents,
      selected_modifiers: (Array.isArray(it.modifiers) ? it.modifiers : []) as SelectedModifier[],
    })),
  };

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href={`/app/quotes/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quote
      </Link>
      <PageHeader
        title="Edit quote"
        description={
          quote.status === 'accepted'
            ? 'Editing an accepted quote — totals and the linked invoice will be updated.'
            : 'Update line items, fees, or event details. Resend after saving to share the new total.'
        }
      />
      <QuoteBuilder
        currency={quote.currency || ctx.org.currency}
        contacts={(contacts ?? []).map((c) => ({
          id: c.id,
          label: [c.first_name, c.last_name].filter(Boolean).join(' ') || '(no name)',
        }))}
        menuItems={itemsForBuilder}
        deals={dealOptions}
        locations={locations ?? []}
        existing={existing}
      />
    </div>
  );
}
