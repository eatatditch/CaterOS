import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';

// We need the raw request body for signature verification — disable any body parsing.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 400 });
  }

  const raw = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, whSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.warn('[stripe webhook] bad signature:', msg);
    return NextResponse.json({ error: 'bad_signature' }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoice_id;
        if (!invoiceId) break;
        if (session.payment_status !== 'paid') break;

        const paymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;
        if (!paymentIntentId) break;

        await admin.rpc('apply_invoice_payment', {
          p_invoice_id: invoiceId,
          p_amount_cents: session.amount_total ?? 0,
          p_currency: (session.currency ?? 'usd').toUpperCase(),
          p_stripe_payment_intent_id: paymentIntentId,
          p_method: 'card',
        });
        break;
      }

      case 'payment_intent.succeeded': {
        // Belt-and-braces in case the Checkout webhook doesn't fire
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoice_id;
        if (!invoiceId) break;
        await admin.rpc('apply_invoice_payment', {
          p_invoice_id: invoiceId,
          p_amount_cents: pi.amount_received ?? pi.amount ?? 0,
          p_currency: pi.currency.toUpperCase(),
          p_stripe_payment_intent_id: pi.id,
          p_method: 'card',
        });
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const pi =
          typeof charge.payment_intent === 'string'
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (!pi) break;
        await admin
          .from('payments')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', pi);
        break;
      }

      default:
        // ignore other event types
        break;
    }
  } catch (err) {
    console.error('[stripe webhook] processing error:', err);
    // Still return 200 — we don't want Stripe to retry infinitely on our bug.
    // Stripe will surface the error in the dashboard Events page.
    return NextResponse.json({ received: true, error: 'processing_error' });
  }

  return NextResponse.json({ received: true });
}
