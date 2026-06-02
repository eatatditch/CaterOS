import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

// Vercel Cron hits this on a schedule (configured in vercel.json).
// We off-session charge the balance on every invoice whose event starts
// within the next 24 hours.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fail-closed constant-time check of the Vercel cron secret.
// Rejects when CRON_SECRET is unset or the Authorization header doesn't match.
function authorizeCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  // Vercel sends "Authorization: Bearer <CRON_SECRET>".
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
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
      // Mark attempted BEFORE creating the PaymentIntent. If the process
      // crashes between here and confirmation, the invoice is excluded from
      // the next tick (list_invoices_due_balance_charge filters on
      // balance_charge_attempted_at), so we never double-charge.
      await admin.rpc('mark_balance_charge_attempted', {
        p_invoice_id: row.invoice_id,
        p_failed_reason: null,
      });

      const intent = await stripe.paymentIntents.create(
        {
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
        },
        // Idempotency key: a retried tick for the same invoice returns the
        // original PaymentIntent rather than creating a second charge.
        { idempotencyKey: `balance-${row.invoice_id}` },
      );

      // Record the payment in-DB immediately so invoice amount_paid/status
      // update even if the webhook never fires. apply_invoice_payment is
      // idempotent on the PI id, so the webhook re-recording is a no-op.
      await admin.rpc('apply_invoice_payment', {
        p_invoice_id: row.invoice_id,
        p_amount_cents: row.balance_cents,
        p_currency: row.currency.toUpperCase(),
        p_stripe_payment_intent_id: intent.id,
        p_method: 'card',
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
