'use server';

import { createAdminClient } from '@/lib/supabase/admin';

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
  return {
    ok: true,
    already_accepted: Boolean(result.already_accepted),
    invoice_token: (result.invoice_token as string | undefined) ?? null,
    deposit_cents: Number(result.deposit_cents ?? 0),
  };
}
