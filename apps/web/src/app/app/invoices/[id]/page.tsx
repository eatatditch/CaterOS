import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Receipt } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge, invoiceStatusTone } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';
import { RecordPaymentForm } from './record-payment-form';
import { VoidPaymentButton } from './void-payment-button';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card_in_person: 'Card (in person)',
  card: 'Card',
  ach: 'ACH / Bank transfer',
  other: 'Other',
};

type Payment = {
  id: string;
  amount_cents: number;
  currency: string;
  method: string | null;
  reference: string | null;
  note: string | null;
  status: string;
  received_at: string | null;
  created_at: string;
  stripe_payment_intent_id: string | null;
  voided_at: string | null;
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id, number, status, total_cents, amount_paid_cents, deposit_amount_cents, deposit_paid_at, currency, due_at, issued_at, paid_at, contacts:contact_id (first_name, last_name, email)',
    )
    .eq('id', id)
    .maybeSingle();
  if (!invoice) notFound();

  const { data: paymentsData } = await supabase
    .from('payments')
    .select(
      'id, amount_cents, currency, method, reference, note, status, received_at, created_at, stripe_payment_intent_id, voided_at',
    )
    .eq('invoice_id', id)
    .order('received_at', { ascending: false, nullsFirst: false });
  const payments = (paymentsData ?? []) as Payment[];

  const contact = invoice.contacts as unknown as {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  const contactName = contact
    ? [contact.first_name, contact.last_name].filter(Boolean).join(' ')
    : '';

  const remainingCents = invoice.total_cents - invoice.amount_paid_cents;
  const depositRemaining = Math.max(
    invoice.deposit_amount_cents - invoice.amount_paid_cents,
    0,
  );
  const canRecord = ctx.role === 'owner' || ctx.role === 'manager';
  // Off-Stripe payments can be voided (reversed) by managers while the invoice
  // is still live. Stripe charges must be refunded in Stripe, so they're not.
  const canVoidOnInvoice =
    canRecord && invoice.status !== 'void' && invoice.status !== 'refunded';

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href="/app/invoices"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>

      <PageHeader
        title={invoice.number}
        description={[
          contactName || 'No contact',
          invoice.issued_at ? `Issued ${formatDate(invoice.issued_at)}` : null,
          invoice.due_at ? `Due ${formatDate(invoice.due_at)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <StatusBadge
            label={invoice.status.replace('_', ' ')}
            tone={invoiceStatusTone(invoice.status)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-6 lg:col-span-1">
          <h2 className="mb-4 font-semibold">Summary</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="tabular-nums font-medium">
                {formatMoney(invoice.total_cents, invoice.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="tabular-nums">
                {formatMoney(invoice.amount_paid_cents, invoice.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t pt-3">
              <dt className="font-medium">Balance</dt>
              <dd className="tabular-nums font-semibold">
                {formatMoney(remainingCents, invoice.currency)}
              </dd>
            </div>
            {invoice.deposit_amount_cents > 0 ? (
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt>
                  Deposit{' '}
                  {invoice.deposit_paid_at
                    ? `· paid ${formatDate(invoice.deposit_paid_at)}`
                    : depositRemaining > 0
                      ? `· ${formatMoney(depositRemaining, invoice.currency)} remaining`
                      : '· paid'}
                </dt>
                <dd className="tabular-nums">
                  {formatMoney(invoice.deposit_amount_cents, invoice.currency)}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-6 lg:col-span-2">
          <h2 className="mb-1 font-semibold">Record a payment</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Use this for cash, checks, in-restaurant card swipes, ACH, or any
            payment received outside Stripe Checkout.
          </p>
          <RecordPaymentForm
            invoiceId={invoice.id}
            remainingCents={remainingCents}
            currency={invoice.currency}
            canRecord={canRecord}
          />
        </section>

        <section className="rounded-lg border bg-card p-6 lg:col-span-3">
          <h2 className="mb-4 font-semibold">Payment history</h2>
          {payments.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <Receipt className="h-4 w-4" />
              No payments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Method</th>
                    <th className="py-2 pr-4 font-medium">Reference</th>
                    <th className="py-2 pr-4 font-medium">Note</th>
                    <th className="py-2 pr-4 text-right font-medium">Amount</th>
                    <th className="py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((p) => {
                    const methodLabel = p.stripe_payment_intent_id
                      ? `${METHOD_LABELS[p.method ?? 'card'] ?? p.method ?? 'Card'} · Stripe`
                      : (METHOD_LABELS[p.method ?? ''] ?? p.method ?? '—');
                    const date = p.received_at ?? p.created_at;
                    const isVoided = Boolean(p.voided_at);
                    // Manager + live invoice + a recorded (non-Stripe) payment
                    // that hasn't been voided yet.
                    const canVoid =
                      canVoidOnInvoice &&
                      !isVoided &&
                      p.status === 'succeeded' &&
                      !p.stripe_payment_intent_id;
                    return (
                      <tr key={p.id} className={isVoided ? 'text-muted-foreground' : ''}>
                        <td className="py-2 pr-4">{formatDate(date)}</td>
                        <td className="py-2 pr-4">
                          {methodLabel}
                          {isVoided ? (
                            <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                              Voided
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {p.reference ?? '—'}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">
                          {p.note ?? '—'}
                        </td>
                        <td
                          className={`py-2 pr-4 text-right tabular-nums font-medium ${
                            isVoided ? 'line-through' : ''
                          }`}
                        >
                          {formatMoney(p.amount_cents, p.currency)}
                        </td>
                        <td className="py-2 text-right">
                          {canVoid ? <VoidPaymentButton paymentId={p.id} /> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
