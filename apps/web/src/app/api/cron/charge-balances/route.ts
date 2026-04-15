import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

// Vercel Cron hits this on a schedule (configured in vercel.json).
// We off-session charge the balance on every invoice whose event starts
// within the next 24 hours.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" if configured.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  const { data: due, error } = await admin.rpc('list_invoices_due_balance_charge');
  if (error) {
    console.error('[cron/charge-balances] list RPC failed', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (due ?? []) as Array<{
    invoice_id: string;
    org_id: string;
    contact_id: string;
    currency: string;
    balance_cents: number;
    stripe_customer_id: string;
    stripe_payment_method_id: string;
    event_date: string;
    org_name: string;
  }>;

  const results: Array<{ invoice_id: string; ok: boolean; message?: string }> = [];

  for (const row of rows) {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: row.balance_cents,
        currency: row.currency.toLowerCase(),
        customer: row.stripe_customer_id,
        payment_method: row.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Balance auto-charge — ${row.org_name}`,
        metadata: {
          invoice_id: row.invoice_id,
          org_id: row.org_id,
          contact_id: row.contact_id,
          type: 'balance',
        },
      });

      // Mark attempted so we don't re-run this invoice this cron tick
      await admin.rpc('mark_balance_charge_attempted', {
        p_invoice_id: row.invoice_id,
        p_failed_reason: null,
      });

      // Log an activity so the catering team sees it in the timeline
      await admin.from('activities').insert({
        org_id: row.org_id,
        type: 'event_log',
        contact_id: row.contact_id,
        subject: 'Auto-charged balance',
        body: `Charged $${(row.balance_cents / 100).toFixed(2)} ${row.currency} off-session for upcoming event. Intent: ${intent.id}`,
        meta: {
          invoice_id: row.invoice_id,
          payment_intent_id: intent.id,
          amount_cents: row.balance_cents,
          type: 'balance_auto_charge',
        },
      });

      results.push({ invoice_id: row.invoice_id, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      console.error('[cron/charge-balances] failed for', row.invoice_id, msg);

      await admin.rpc('mark_balance_charge_attempted', {
        p_invoice_id: row.invoice_id,
        p_failed_reason: msg.slice(0, 500),
      });

      await admin.from('activities').insert({
        org_id: row.org_id,
        type: 'event_log',
        contact_id: row.contact_id,
        subject: 'Balance auto-charge failed',
        body: `Attempted to charge $${(row.balance_cents / 100).toFixed(2)} but Stripe declined: ${msg}`,
        meta: {
          invoice_id: row.invoice_id,
          amount_cents: row.balance_cents,
          type: 'balance_auto_charge_failed',
          error: msg,
        },
      });

      results.push({ invoice_id: row.invoice_id, ok: false, message: msg });
    }
  }

  return NextResponse.json({
    ran_at: new Date().toISOString(),
    total: rows.length,
    results,
  });
}
