'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { computeQuoteTotals, formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, tryCreateAdminClient } from '@/lib/supabase/admin';
import { requireCurrent } from '@/lib/auth/current';
import { getConnectionForOrg, sendEmail } from '@/lib/gmail/client';

const modifierSchema = z.object({
  group_id: z.string(),
  group_name: z.string(),
  modifier_id: z.string(),
  name: z.string(),
  price_delta_cents: z.number().int(),
});

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().min(1),
  unit_price_cents: z.number().int().min(0),
  menu_item_id: z.string().uuid().optional().nullable(),
  modifiers: z.array(modifierSchema).optional().default([]),
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
    modifiers: it.modifiers ?? [],
  }));
  const { error: itemsErr } = await supabase.from('quote_items').insert(itemsPayload);
  if (itemsErr) return { error: itemsErr.message };

  // Sync the linked deal's expected value so the pipeline shows the quote total.
  if (parsed.data.deal_id) {
    await supabase
      .from('deals')
      .update({ amount_cents: totals.totalCents, currency: ctx.org.currency })
      .eq('id', parsed.data.deal_id);
    revalidatePath('/app/pipeline');
    revalidatePath(`/app/deals/${parsed.data.deal_id}`);
  }

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

/**
 * Delete a quote. Cascades to quote_items (FK on delete cascade). If there's
 * a linked invoice with ZERO payments, deletes that too. Blocks deletion if
 * any payment has been recorded — the admin must refund from Stripe first.
 */
export async function deleteQuote(id: string) {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const admin = tryCreateAdminClient();

  // Is there an invoice linked to this quote? (use admin if available so we
  // bypass RLS on payments for the check)
  const client = admin ?? supabase;
  const { data: invoices } = await client
    .from('invoices')
    .select('id, number, amount_paid_cents')
    .eq('quote_id', id);

  for (const inv of invoices ?? []) {
    if ((inv.amount_paid_cents ?? 0) > 0) {
      return {
        error: `Can't delete — invoice ${inv.number} has a payment recorded. Refund it in Stripe first, then try again.`,
      };
    }
  }

  // Non-paid invoices: delete them + any payment attempts
  if ((invoices ?? []).length > 0 && admin) {
    const invoiceIds = invoices!.map((i) => i.id);
    await admin.from('payments').delete().in('invoice_id', invoiceIds);
    await admin.from('invoices').delete().in('id', invoiceIds);
  }

  // Cascade: remove any calendar events tied to this quote so they don't
  // linger on the events calendar / dispatch board.
  await client.from('events').delete().eq('quote_id', id);

  // quote_items cascade via FK; deals stay (they may pre-date the quote)
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) return { error: error.message };

  // Log audit
  if (admin) {
    await admin.from('audit_logs').insert({
      org_id: ctx.org.id,
      actor_id: ctx.user.id,
      action: 'delete',
      entity: 'quote',
      entity_id: id,
    });
  }

  revalidatePath('/app/quotes');
  revalidatePath('/app/pipeline');
  revalidatePath('/app/events');
  revalidatePath('/app/dispatch');
  return { ok: true };
}

const sendSchema = z.object({
  quote_id: z.string().uuid(),
  to: z.string().email(),
  subject: z.string().trim().min(1).max(300),
  message: z.string().trim().max(8000).optional().default(''),
});

function formatEventDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Email the quote to the client via the org's connected Gmail account,
 * mark the quote as `sent`, move the linked deal to the "Quote Sent" stage,
 * and log an activity.
 */
export async function sendQuote(input: z.infer<typeof sendSchema>) {
  const ctx = await requireCurrent();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const supabase = await createClient();
  const admin = tryCreateAdminClient();

  // Gather quote, items, org info
  const [{ data: quote }, { data: items }, { data: org }] = await Promise.all([
    supabase
      .from('quotes')
      .select('id, number, deal_id, contact_id, headcount, event_date, subtotal_cents, tax_cents, service_fee_cents, delivery_fee_cents, gratuity_cents, discount_cents, total_cents, currency, notes, public_token, status')
      .eq('id', parsed.data.quote_id)
      .maybeSingle(),
    supabase
      .from('quote_items')
      .select('id, name, description, quantity, unit_price_cents, total_cents, position')
      .eq('quote_id', parsed.data.quote_id)
      .order('position'),
    supabase.from('orgs').select('name').eq('id', ctx.org.id).maybeSingle(),
  ]);

  if (!quote) return { error: 'Quote not found.' };

  const connection = await getConnectionForOrg(ctx.org.id);
  if (!connection) {
    return {
      error: 'No Gmail account connected. Connect one in Settings → Integrations first.',
    };
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const viewUrl = quote.public_token
    ? `${appUrl}/quote/${quote.public_token}`
    : `${appUrl}/app/quotes/${quote.id}`;

  const { html, text } = renderQuoteEmail({
    number: quote.number,
    orgName: org?.name ?? 'Catering',
    introMessage: parsed.data.message,
    eventDateLabel: formatEventDate(quote.event_date),
    headcount: quote.headcount,
    items: items ?? [],
    subtotalCents: quote.subtotal_cents,
    discountCents: quote.discount_cents,
    serviceFeeCents: quote.service_fee_cents,
    deliveryFeeCents: quote.delivery_fee_cents,
    taxCents: quote.tax_cents,
    gratuityCents: quote.gratuity_cents,
    totalCents: quote.total_cents,
    currency: quote.currency,
    viewUrl,
  });

  // Send the email
  try {
    await sendEmail(connection, {
      to: parsed.data.to,
      subject: parsed.data.subject,
      textBody: text,
      htmlBody: html,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to send';
    return { error: `Gmail send failed: ${msg}` };
  }

  // Mark quote as sent
  await supabase
    .from('quotes')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', quote.id);

  // Move linked deal to "Quote Sent" stage (if deal exists)
  if (quote.deal_id && admin) {
    const { data: dealRow } = await admin
      .from('deals')
      .select('pipeline_id, stage_id')
      .eq('id', quote.deal_id)
      .maybeSingle();
    if (dealRow) {
      const { data: quoteSentStage } = await admin
        .from('stages')
        .select('id')
        .eq('pipeline_id', dealRow.pipeline_id)
        .eq('name', 'Quote Sent')
        .maybeSingle();
      const patch: Record<string, unknown> = {
        amount_cents: quote.total_cents,
        currency: quote.currency,
      };
      if (quoteSentStage && quoteSentStage.id !== dealRow.stage_id) {
        patch.stage_id = quoteSentStage.id;
      }
      await admin.from('deals').update(patch).eq('id', quote.deal_id);
    }
  }

  // Log activity
  if (admin) {
    await admin.from('activities').insert({
      org_id: ctx.org.id,
      type: 'email',
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      owner_id: ctx.user.id,
      subject: `Sent quote ${quote.number}`,
      body: `Emailed to ${parsed.data.to}`,
      meta: {
        quote_id: quote.id,
        quote_number: quote.number,
        to: parsed.data.to,
        view_url: viewUrl,
        outbound: true,
      },
    });
  }

  revalidatePath('/app/quotes');
  revalidatePath(`/app/quotes/${quote.id}`);
  revalidatePath('/app/pipeline');
  if (quote.deal_id) revalidatePath(`/app/deals/${quote.deal_id}`);
  return { ok: true };
}

// ─── Email rendering helpers ────────────────────────────────────────────────
type RenderedEmail = { html: string; text: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderQuoteEmail(args: {
  number: string;
  orgName: string;
  introMessage: string;
  eventDateLabel: string;
  headcount: number;
  items: Array<{
    name: string;
    description: string | null;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
  }>;
  subtotalCents: number;
  discountCents: number;
  serviceFeeCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  gratuityCents: number;
  totalCents: number;
  currency: string;
  viewUrl: string;
}): RenderedEmail {
  const {
    number,
    orgName,
    introMessage,
    eventDateLabel,
    headcount,
    items,
    subtotalCents,
    discountCents,
    serviceFeeCents,
    deliveryFeeCents,
    taxCents,
    gratuityCents,
    totalCents,
    currency,
    viewUrl,
  } = args;

  const moneyCell = (cents: number) => formatMoney(cents, currency);

  const itemRows = items
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e4e4e7;vertical-align:top">
            <div style="font-weight:500">${escapeHtml(it.name)}</div>
            ${it.description ? `<div style="font-size:12px;color:#71717a">${escapeHtml(it.description)}</div>` : ''}
          </td>
          <td style="padding:10px 0;border-top:1px solid #e4e4e7;text-align:right;width:60px;vertical-align:top">${it.quantity}</td>
          <td style="padding:10px 0;border-top:1px solid #e4e4e7;text-align:right;width:100px;vertical-align:top">${escapeHtml(moneyCell(it.unit_price_cents))}</td>
          <td style="padding:10px 0;border-top:1px solid #e4e4e7;text-align:right;width:100px;vertical-align:top;font-weight:500">${escapeHtml(moneyCell(it.total_cents))}</td>
        </tr>`,
    )
    .join('');

  const totalRow = (label: string, amount: number) =>
    amount === 0
      ? ''
      : `<tr><td colspan="3" style="padding:4px 0;text-align:right;color:#52525b">${label}</td><td style="padding:4px 0;text-align:right">${escapeHtml(moneyCell(amount))}</td></tr>`;

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:24px 12px;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:600px;margin:0 auto">
    <div style="color:#52525b;margin-bottom:24px;font-weight:600">${escapeHtml(orgName)}</div>
    <div style="background:#fff;border-radius:10px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#a1a1aa;margin-bottom:8px">Quote ${escapeHtml(number)}</div>
      ${introMessage ? `<p style="margin:0 0 18px 0;color:#18181b;white-space:pre-wrap">${escapeHtml(introMessage)}</p>` : ''}
      ${eventDateLabel || headcount > 0 ? `<div style="padding:14px 16px;background:#fafafa;border-radius:8px;font-size:14px;margin:8px 0 16px">${eventDateLabel ? `<div>📅 ${escapeHtml(eventDateLabel)}</div>` : ''}${headcount > 0 ? `<div style="margin-top:4px">👥 ${headcount} guests</div>` : ''}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="text-align:left;color:#a1a1aa;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">
            <th style="padding:8px 0">Item</th>
            <th style="padding:8px 0;text-align:right">Qty</th>
            <th style="padding:8px 0;text-align:right">Price</th>
            <th style="padding:8px 0;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr><td colspan="3" style="padding:12px 0 4px;text-align:right;color:#52525b;border-top:1px solid #e4e4e7">Subtotal</td><td style="padding:12px 0 4px;text-align:right;border-top:1px solid #e4e4e7">${escapeHtml(moneyCell(subtotalCents))}</td></tr>
          ${totalRow('Discount', -discountCents)}
          ${totalRow('Service fee', serviceFeeCents)}
          ${totalRow('Delivery', deliveryFeeCents)}
          ${totalRow('Tax', taxCents)}
          ${totalRow('Gratuity', gratuityCents)}
          <tr><td colspan="3" style="padding:10px 0;text-align:right;border-top:1px solid #e4e4e7;font-weight:700;font-size:16px">Total</td><td style="padding:10px 0;text-align:right;border-top:1px solid #e4e4e7;font-weight:700;font-size:16px">${escapeHtml(moneyCell(totalCents))}</td></tr>
        </tfoot>
      </table>
      <div style="text-align:center;margin-top:24px">
        <a href="${viewUrl}" style="display:inline-block;background:#ea580c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">View &amp; accept quote</a>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;font-size:11px;color:#a1a1aa">Powered by CaterOS</div>
  </div>
</body>
</html>`;

  const textLines: string[] = [];
  if (introMessage) {
    textLines.push(introMessage);
    textLines.push('');
  }
  textLines.push(`Quote ${number} from ${orgName}`);
  if (eventDateLabel) textLines.push(`Event: ${eventDateLabel}`);
  if (headcount > 0) textLines.push(`Guests: ${headcount}`);
  textLines.push('');
  for (const it of items) {
    textLines.push(`${it.quantity} × ${it.name} — ${moneyCell(it.total_cents)}`);
  }
  textLines.push('');
  textLines.push(`Subtotal: ${moneyCell(subtotalCents)}`);
  if (discountCents > 0) textLines.push(`Discount: −${moneyCell(discountCents)}`);
  if (serviceFeeCents > 0) textLines.push(`Service fee: ${moneyCell(serviceFeeCents)}`);
  if (deliveryFeeCents > 0) textLines.push(`Delivery: ${moneyCell(deliveryFeeCents)}`);
  if (taxCents > 0) textLines.push(`Tax: ${moneyCell(taxCents)}`);
  if (gratuityCents > 0) textLines.push(`Gratuity: ${moneyCell(gratuityCents)}`);
  textLines.push(`TOTAL: ${moneyCell(totalCents)}`);
  textLines.push('');
  textLines.push(`View and accept: ${viewUrl}`);

  return { html, text: textLines.join('\n') };
}
