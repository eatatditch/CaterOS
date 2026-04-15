import Link from 'next/link';
import { Check, ChefHat } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DepositSuccessPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Pull the invoice for nicer copy; non-fatal if it's not found.
  const { data: quoteRow } = await supabase
    .from('quotes')
    .select('id')
    .eq('public_token', token)
    .maybeSingle();
  const invoiceQuery = quoteRow
    ? await supabase
        .from('invoices')
        .select('number, total_cents, amount_paid_cents, deposit_amount_cents, currency, org_id, contact_id')
        .eq('quote_id', quoteRow.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const invoice = invoiceQuery.data;

  const [{ data: org }, { data: contact }] = invoice
    ? await Promise.all([
        supabase.from('orgs').select('name').eq('id', invoice.org_id).maybeSingle(),
        invoice.contact_id
          ? supabase
              .from('contacts')
              .select('first_name')
              .eq('id', invoice.contact_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }];

  const remaining = invoice
    ? invoice.total_cents - invoice.amount_paid_cents
    : 0;

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 24,
          color: '#52525b',
        }}
      >
        <ChefHat style={{ width: 20, height: 20, color: '#ea580c' }} />
        <span style={{ fontWeight: 600 }}>{org?.name ?? 'Catering'}</span>
      </header>

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          padding: '40px 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#dcfce7',
            marginBottom: 16,
          }}
        >
          <Check style={{ width: 32, height: 32, color: '#166534' }} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          Deposit received{contact?.first_name ? `, ${contact.first_name}` : ''}!
        </h1>
        <p style={{ marginTop: 10, color: '#52525b' }}>
          Your event is officially booked. We&apos;ll be in touch with next steps shortly.
        </p>

        {invoice ? (
          <div
            style={{
              marginTop: 24,
              padding: '16px 20px',
              background: '#fafafa',
              borderRadius: 8,
              textAlign: 'left',
              fontSize: 14,
            }}
          >
            <Row label="Invoice" value={invoice.number} />
            <Row
              label="Deposit paid"
              value={formatMoney(invoice.amount_paid_cents, invoice.currency)}
            />
            <Row
              label="Balance due"
              value={formatMoney(remaining, invoice.currency)}
              sub={remaining > 0 ? 'Due by event date' : 'Paid in full'}
            />
          </div>
        ) : null}

        <Link
          href={`/quote/${token}`}
          style={{
            display: 'inline-block',
            marginTop: 24,
            fontSize: 13,
            color: '#52525b',
            textDecoration: 'none',
          }}
        >
          Back to quote
        </Link>
      </div>

      <div
        style={{
          marginTop: 16,
          textAlign: 'center',
          fontSize: 11,
          color: '#a1a1aa',
        }}
      >
        Powered by CaterOS · Payment processed by Stripe
      </div>
    </div>
  );
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        padding: '4px 0',
        color: '#52525b',
      }}
    >
      <span>{label}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ fontWeight: 600, color: '#18181b' }}>{value}</span>
        {sub ? (
          <span style={{ display: 'block', fontSize: 11, color: '#a1a1aa' }}>{sub}</span>
        ) : null}
      </span>
    </div>
  );
}
