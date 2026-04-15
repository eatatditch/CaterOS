'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChefHat, CreditCard, Check } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';

type Invoice = {
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

/**
 * Auto-initiates the Stripe Checkout flow. The client lands here after
 * accepting the quote; we POST to /api/stripe/checkout, get back a URL,
 * and redirect the browser to Stripe's hosted checkout.
 *
 * If the redirect fails for any reason, or the client cancels and comes
 * back, we show a manual "Pay deposit" button so they can retry.
 */
export function DepositRedirect({
  invoice,
  cancelled,
}: {
  invoice: Invoice;
  cancelled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [didAutoStart, setDidAutoStart] = useState(false);

  const outstanding = invoice.deposit_amount_cents - invoice.amount_paid_cents;
  const alreadyPaid = outstanding <= 0;

  function startCheckout() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invoice_token: invoice.public_token }),
        });
        const body = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !body.url) {
          setError(body.error ?? 'Could not start payment. Please try again.');
          return;
        }
        window.location.href = body.url;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      }
    });
  }

  // Kick off checkout automatically on first render unless cancelled or paid
  useEffect(() => {
    if (didAutoStart || cancelled || alreadyPaid) return;
    setDidAutoStart(true);
    startCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = invoice.contact?.first_name ?? 'there';

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
        <span style={{ fontWeight: 600 }}>{invoice.org?.name ?? 'Catering'}</span>
      </header>

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          padding: '32px 28px',
        }}
      >
        {alreadyPaid ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#dcfce7',
                  marginBottom: 12,
                }}
              >
                <Check style={{ width: 24, height: 24, color: '#166534' }} />
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Deposit received</h1>
              <p style={{ marginTop: 8, color: '#52525b' }}>
                Thanks, {firstName}! Your spot is locked in. We&apos;ll be in touch with next
                steps shortly.
              </p>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <CreditCard
                style={{ width: 32, height: 32, color: '#ea580c', marginBottom: 8 }}
              />
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                Leave a deposit to lock in your event
              </h1>
              <p style={{ marginTop: 8, color: '#52525b', fontSize: 14 }}>
                Invoice {invoice.number} · {firstName}
              </p>
            </div>

            <div
              style={{
                background: '#fafafa',
                borderRadius: 8,
                padding: '16px 20px',
                marginBottom: 20,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: '#a1a1aa',
                  marginBottom: 4,
                }}
              >
                Deposit due
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>
                {formatMoney(outstanding, invoice.currency)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 6 }}>
                of {formatMoney(invoice.total_cents, invoice.currency)} total
              </div>
            </div>

            {cancelled ? (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  background: '#fef3c7',
                  color: '#92400e',
                  borderRadius: 8,
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Payment was cancelled — try again when you&apos;re ready.
              </div>
            ) : !didAutoStart ? null : isPending ? (
              <p style={{ textAlign: 'center', color: '#71717a', fontSize: 13, marginBottom: 12 }}>
                Redirecting to secure payment…
              </p>
            ) : null}

            <button
              type="button"
              onClick={startCheckout}
              disabled={isPending}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: '#ea580c',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: isPending ? 'wait' : 'pointer',
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? 'Loading…' : 'Pay deposit with card'}
            </button>

            {error ? (
              <p style={{ marginTop: 10, color: '#b91c1c', fontSize: 13, textAlign: 'center' }}>
                {error}
              </p>
            ) : null}

            <p
              style={{
                marginTop: 16,
                fontSize: 11,
                color: '#a1a1aa',
                textAlign: 'center',
              }}
            >
              Secure payment powered by Stripe · Card info never touches our servers
            </p>
          </>
        )}
      </div>
    </div>
  );
}
