'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { enrollContactsForTrigger } from '@/lib/actions/marketing';

export type AcceptResult =
  | {
      ok: true;
      already_accepted?: boolean;
      invoice_token: string | null;
      deposit_cents: number;
    }
  | { error: string };

export async function acceptQuote(token: string): Promise<AcceptResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('accept_quote', { p_token: token });
  if (error) {
    if (error.message.includes('quote_not_found')) return { error: 'Quote not found.' };
    if (error.message.includes('quote_not_acceptable')) {
      return { error: 'This quote is no longer acceptable.' };
    }
    return { error: error.message };
  }

  const result = (data ?? {}) as Record<string, unknown>;

  // Best-effort: auto-enroll the quote's contact into active 'quote_accepted'
  // sequences. Resolve contact + org from the public token (no session here).
  // Skip on re-acceptance so we don't re-trigger. Never block acceptance.
  if (!result.already_accepted) {
    try {
      const { data: quote } = await supabase
        .from('quotes')
        .select('org_id, contact_id')
        .eq('public_token', token)
        .maybeSingle();
      if (quote?.contact_id && quote.org_id) {
        await enrollContactsForTrigger(quote.org_id, quote.contact_id, 'quote_accepted');
      }
    } catch (err) {
      console.error('[acceptQuote] enrollment failed', err);
    }
  }

  return {
    ok: true,
    already_accepted: Boolean(result.already_accepted),
    invoice_token: (result.invoice_token as string | undefined) ?? null,
    deposit_cents: Number(result.deposit_cents ?? 0),
  };
}
