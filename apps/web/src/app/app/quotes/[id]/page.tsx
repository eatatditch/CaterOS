import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge, quoteStatusTone } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import { QuoteActions } from './quote-actions';

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from('quotes')
    .select('*, contacts:contact_id (first_name, last_name, email)')
    .eq('id', id)
    .maybeSingle();
  if (!quote) notFound();

  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', id)
    .order('position');

  const contactName = quote.contacts
    ? [
        (quote.contacts as unknown as { first_name: string | null }).first_name,
        (quote.contacts as unknown as { last_name: string | null }).last_name,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href="/app/quotes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>

      <PageHeader
        title={quote.number}
        description={`${contactName || 'No contact'} · ${quote.headcount} guests${
          quote.event_date ? ' · ' + formatDate(quote.event_date) : ''
        }`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge label={quote.status} tone={quoteStatusTone(quote.status)} />
            <QuoteActions id={id} status={quote.status} />
          </div>
        }
      />

      <section className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Item</th>
              <th className="px-4 py-3 text-right font-medium">Qty</th>
              <th className="px-4 py-3 text-right font-medium">Price</th>
              <th className="px-4 py-3 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{it.name}</div>
                  {it.description ? (
                    <div className="text-xs text-muted-foreground">{it.description}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{it.quantity}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(it.unit_price_cents, quote.currency)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums">
                  {formatMoney(it.total_cents, quote.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <Totals quote={quote} />
          </tfoot>
        </table>
      </section>

      {quote.notes ? (
        <section className="mt-6 rounded-lg border bg-card p-6">
          <h3 className="mb-2 font-semibold">Notes</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{quote.notes}</p>
        </section>
      ) : null}
    </div>
  );
}

function Totals({ quote }: { quote: Record<string, number | string> }) {
  const row = (label: string, amount: number) =>
    amount > 0 && (
      <tr>
        <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
          {label}
        </td>
        <td className="px-4 py-2 text-right tabular-nums">
          {formatMoney(amount, String(quote.currency))}
        </td>
      </tr>
    );
  return (
    <>
      <tr className="border-t">
        <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
          Subtotal
        </td>
        <td className="px-4 py-2 text-right tabular-nums">
          {formatMoney(Number(quote.subtotal_cents), String(quote.currency))}
        </td>
      </tr>
      {row('Discount', -Number(quote.discount_cents))}
      {row('Service fee', Number(quote.service_fee_cents))}
      {row('Delivery', Number(quote.delivery_fee_cents))}
      {row('Tax', Number(quote.tax_cents))}
      {row('Gratuity', Number(quote.gratuity_cents))}
      <tr className="border-t bg-muted/40">
        <td colSpan={3} className="px-4 py-3 text-right font-semibold">
          Total
        </td>
        <td className="px-4 py-3 text-right font-semibold tabular-nums">
          {formatMoney(Number(quote.total_cents), String(quote.currency))}
        </td>
      </tr>
    </>
  );
}
