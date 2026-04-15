'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { computeQuoteTotals } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().min(1),
  unit_price_cents: z.number().int().min(0),
  menu_item_id: z.string().uuid().optional().nullable(),
});

const createSchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
  headcount: z.number().int().min(0).default(0),
  event_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tax_rate: z.number().min(0).max(1).default(0),
  service_fee_rate: z.number().min(0).max(1).default(0),
  delivery_fee_cents: z.number().int().min(0).default(0),
  gratuity_rate: z.number().min(0).max(1).default(0),
  discount_cents: z.number().int().min(0).default(0),
  items: z.array(itemSchema).min(1, 'Add at least one item'),
});

function randomToken() {
  return (
    Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  );
}

async function nextQuoteNumber(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string) {
  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;
  const { data: last } = await supabase
    .from('quotes')
    .select('number')
    .eq('org_id', orgId)
    .like('number', `${prefix}%`)
    .order('number', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNum = last?.number ? parseInt(last.number.slice(prefix.length), 10) || 0 : 0;
  return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
}

export async function createQuote(input: z.infer<typeof createSchema>) {
  const ctx = await requireCurrent();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const subtotal = parsed.data.items.reduce(
    (sum, it) => sum + it.quantity * it.unit_price_cents,
    0,
  );
  const totals = computeQuoteTotals({
    subtotalCents: subtotal,
    taxRate: parsed.data.tax_rate,
    serviceFeeRate: parsed.data.service_fee_rate,
    deliveryFeeCents: parsed.data.delivery_fee_cents,
    gratuityRate: parsed.data.gratuity_rate,
    discountCents: parsed.data.discount_cents,
  });

  const number = await nextQuoteNumber(supabase, ctx.org.id);

  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      org_id: ctx.org.id,
      number,
      contact_id: parsed.data.contact_id || null,
      deal_id: parsed.data.deal_id || null,
      headcount: parsed.data.headcount,
      event_date: parsed.data.event_date || null,
      notes: parsed.data.notes || null,
      subtotal_cents: totals.subtotalCents,
      tax_cents: totals.taxCents,
      service_fee_cents: totals.serviceFeeCents,
      delivery_fee_cents: totals.deliveryFeeCents,
      gratuity_cents: totals.gratuityCents,
      discount_cents: totals.discountCents,
      total_cents: totals.totalCents,
      currency: ctx.org.currency,
      public_token: randomToken(),
      meta: {
        tax_rate: parsed.data.tax_rate,
        service_fee_rate: parsed.data.service_fee_rate,
        gratuity_rate: parsed.data.gratuity_rate,
      },
    })
    .select('id')
    .single();

  if (error || !quote) return { error: error?.message ?? 'Failed to create quote' };

  const itemsPayload = parsed.data.items.map((it, idx) => ({
    quote_id: quote.id,
    org_id: ctx.org.id,
    name: it.name,
    description: it.description ?? null,
    quantity: it.quantity,
    unit_price_cents: it.unit_price_cents,
    total_cents: it.quantity * it.unit_price_cents,
    position: idx,
    menu_item_id: it.menu_item_id ?? null,
  }));
  const { error: itemsErr } = await supabase.from('quote_items').insert(itemsPayload);
  if (itemsErr) return { error: itemsErr.message };

  revalidatePath('/app/quotes');
  redirect(`/app/quotes/${quote.id}`);
}

export async function setQuoteStatus(
  id: string,
  status: 'draft' | 'sent' | 'accepted' | 'declined',
) {
  await requireCurrent();
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'sent') patch.sent_at = new Date().toISOString();
  if (status === 'accepted') patch.accepted_at = new Date().toISOString();
  const { error } = await supabase.from('quotes').update(patch).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/quotes');
  revalidatePath(`/app/quotes/${id}`);
  return { ok: true };
}
