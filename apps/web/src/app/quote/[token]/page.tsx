import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { QuoteView } from './quote-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type QuotePayload = {
  id: string;
  number: string;
  status: string;
  headcount: number;
  event_date: string | null;
  subtotal_cents: number;
  tax_cents: number;
  service_fee_cents: number;
  delivery_fee_cents: number;
  gratuity_cents: number;
  discount_cents: number;
  total_cents: number;
  deposit_cents: number;
  currency: string;
  notes: string | null;
  terms_html: string | null;
  org: { name: string; currency: string; timezone: string } | null;
  contact: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
    position: number;
    modifiers?: Array<{ group_name: string; name: string; price_delta_cents?: number }> | null;
  }>;
};

export default async function PublicQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_quote_by_token', { p_token: token });
  if (error || !data) notFound();

  const quote = data as QuotePayload;

  // Flip status to 'viewed' on first open (non-fatal)
  try {
    await supabase.rpc('mark_quote_viewed', { p_token: token });
  } catch {
    /* noop */
  }

  return <QuoteView quote={quote} token={token} />;
}
