import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { DepositRedirect } from './deposit-redirect';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type InvoiceLite = {
  public_token: string;
  number: string;
  status: string;
  total_cents: number;
  amount_paid_cents: number;
  deposit_amount_cents: number;
  currency: string;
  org: { name: string } | null;
  contact: { first_name: string | null; email: string | null } | null;
};

export default async function DepositPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const { token } = await params;
  const sp = (await searchParams) ?? {};
  const supabase = createAdminClient();

  // Find the most recent invoice linked to this quote token
  const { data: quoteRow } = await supabase
    .from('quotes')
    .select('id')
    .eq('public_token', token)
    .maybeSingle();
  if (!quoteRow) notFound();

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'public_token, number, status, total_cents, amount_paid_cents, deposit_amount_cents, currency, org_id, contact_id',
    )
    .eq('quote_id', quoteRow.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: org }, { data: contact }] = await Promise.all([
    supabase.from('orgs').select('name').eq('id', invoice.org_id).maybeSingle(),
    invoice.contact_id
      ? supabase
          .from('contacts')
          .select('first_name, email')
          .eq('id', invoice.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const payload: InvoiceLite = {
    public_token: invoice.public_token,
    number: invoice.number,
    status: invoice.status,
    total_cents: invoice.total_cents,
    amount_paid_cents: invoice.amount_paid_cents,
    deposit_amount_cents: invoice.deposit_amount_cents,
    currency: invoice.currency,
    org: org ?? null,
    contact: contact ?? null,
  };

  return <DepositRedirect invoice={payload} cancelled={sp.cancelled === '1'} />;
}
