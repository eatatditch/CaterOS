import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAppUrl, getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Creates a Stripe Checkout Session for an invoice's deposit.
 * Body: { invoice_token: string }   (the invoice.public_token minted at accept)
 * Returns: { url: string }
 * Public endpoint — anyone holding the token can start a checkout.
 */
export async function POST(request: NextRequest) {
  let body: { invoice_token?: string };
  try {
    body = (await request.json()) as { invoice_token?: string };
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!body.invoice_token) {
    return NextResponse.json({ error: 'missing_invoice_token' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from('invoices')
    .select(
      'id, org_id, number, total_cents, amount_paid_cents, deposit_amount_cents, currency, public_token, quote_id, contact_id, status',
    )
    .eq('public_token', body.invoice_token)
    .maybeSingle();

  if (error || !invoice) {
    return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 });
  }

  const outstandingDeposit =
    (invoice.deposit_amount_cents ?? 0) - (invoice.amount_paid_cents ?? 0);
  if (outstandingDeposit <= 0) {
    return NextResponse.json(
      { error: 'deposit_already_paid', invoice_number: invoice.number },
      { status: 400 },
    );
  }

  const [{ data: org }, { data: contact }, { data: quote }] = await Promise.all([
    admin.from('orgs').select('name').eq('id', invoice.org_id).maybeSingle(),
    invoice.contact_id
      ? admin
          .from('contacts')
          .select('email, first_name, last_name')
          .eq('id', invoice.contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    invoice.quote_id
      ? admin
          .from('quotes')
          .select('number, public_token')
          .eq('id', invoice.quote_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const appUrl = getAppUrl();
  const stripe = getStripe();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: invoice.currency.toLowerCase(),
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: {
              name: `Deposit — ${org?.name ?? 'Catering'}`,
              description: `Invoice ${invoice.number}${quote ? ` · Quote ${quote.number}` : ''}`,
            },
            unit_amount: outstandingDeposit,
          },
          quantity: 1,
        },
      ],
      customer_email: contact?.email ?? undefined,
      // Save the customer + card for off-session balance auto-charge later.
      customer_creation: 'always',
      success_url: `${appUrl}/quote/${quote?.public_token ?? ''}/deposit/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: quote?.public_token
        ? `${appUrl}/quote/${quote.public_token}/deposit?cancelled=1`
        : `${appUrl}/invoice/${invoice.public_token}`,
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.number,
        quote_id: invoice.quote_id ?? '',
        org_id: invoice.org_id,
        type: 'deposit',
      },
      payment_intent_data: {
        // Save the payment method so we can off-session charge the balance
        // 24 hours before the event without bothering the client again.
        setup_future_usage: 'off_session',
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.number,
          org_id: invoice.org_id,
          contact_id: invoice.contact_id ?? '',
          type: 'deposit',
        },
        description: `Deposit for ${invoice.number}`,
      },
    });

    // Persist the session id so we can find it later if needed
    await admin
      .from('invoices')
      .update({ stripe_checkout_session_id: session.id })
      .eq('id', invoice.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe/checkout]', err);
    const msg = err instanceof Error ? err.message : 'stripe_error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
