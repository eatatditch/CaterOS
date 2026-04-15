'use server';

import { createAdminClient } from '@/lib/supabase/admin';

export async function acceptQuote(token: string): Promise<{ ok?: true; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc('accept_quote', { p_token: token });
  if (error) {
    if (error.message.includes('quote_not_found')) return { error: 'Quote not found.' };
    if (error.message.includes('quote_not_acceptable')) {
      return { error: 'This quote is no longer acceptable.' };
    }
    return { error: error.message };
  }
  return { ok: true };
}
