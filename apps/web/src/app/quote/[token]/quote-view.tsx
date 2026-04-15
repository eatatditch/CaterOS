'use client';

import { useState, useTransition } from 'react';
import { Check, ChefHat, Calendar, Users } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { acceptQuote } from './accept-action';

type Item = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
};

type Quote = {
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
  org: { name: string } | null;
  contact: { first_name: string | null; last_name: string | null; email: string | null } | null;
  items: Item[];
};

export function QuoteView({ quote, token }: { quote: Quote; token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(
    quote.status === 'accepted' || quote.status === 'converted',
  );

  function onAccept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptQuote(token);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setAccepted(true);
      // If a deposit is due, send them straight to the deposit flow
      if (res.deposit_cents > 0) {
        window.location.href = `/quote/${token}/deposit`;
      }
    });
  }

  const clientName =
    [quote.contact?.first_name, quote.contact?.last_name].filter(Boolean).join(' ') || 'Client';
  const eventDate = quote.event_date
    ? new Date(quote.event_date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 32,
          color: '#52525b',
        }}
      >
        <ChefHat style={{ width: 20, height: 20, color: '#ea580c' }} />
        <span style={{ fontWeight: 600 }}>{quote.org?.name ?? 'Catering'}</span>
      </header>

      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '28px 28px 20px' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#a1a1aa',
              marginBottom: 8,
            }}
          >
            Quote {quote.number}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Hi {clientName},</h1>
          <p style={{ color: '#52525b', marginTop: 8 }}>
            Here&apos;s a quote for your event. Review below and accept when you&apos;re ready.
          </p>
        </div>

        {(eventDate || quote.headcount > 0) && (
          <div
            style={{
              padding: '16px 28px',
              borderTop: '1px solid #e4e4e7',
              borderBottom: '1px solid #e4e4e7',
              background: '#fafafa',
              display: 'grid',
              gridTemplateColumns: eventDate && quote.headcount > 0 ? '1fr 1fr' : '1fr',
              gap: 16,
              fontSize: 14,
            }}
          >
            {eventDate ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar style={{ width: 16, height: 16, color: '#71717a' }} />
                <span>{eventDate}</span>
              </div>
            ) : null}
            {quote.headcount > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users style={{ width: 16, height: 16, color: '#71717a' }} />
                <span>{quote.headcount} guests</span>
              </div>
            ) : null}
          </div>
        )}

        <div style={{ padding: '20px 28px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#a1a1aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '8px 0' }}>Item</th>
                <th style={{ padding: '8px 0', textAlign: 'right', width: 60 }}>Qty</th>
                <th style={{ padding: '8px 0', textAlign: 'right', width: 90 }}>Price</th>
                <th style={{ padding: '8px 0', textAlign: 'right', width: 90 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it) => (
                <tr key={it.id} style={{ borderTop: '1px solid #e4e4e7' }}>
                  <td style={{ padding: '10px 0' }}>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    {it.description ? (
                      <div style={{ fontSize: 12, color: '#71717a' }}>{it.description}</div>
                    ) : null}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {it.quantity}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(it.unit_price_cents, quote.currency)}
                  </td>
                  <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(it.total_cents, quote.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '16px 28px', borderTop: '1px solid #e4e4e7', fontSize: 14 }}>
          <TotalRow label="Subtotal" amount={quote.subtotal_cents} currency={quote.currency} />
          {quote.discount_cents > 0 && (
            <TotalRow label="Discount" amount={-quote.discount_cents} currency={quote.currency} />
          )}
          {quote.service_fee_cents > 0 && (
            <TotalRow label="Service fee" amount={quote.service_fee_cents} currency={quote.currency} />
          )}
          {quote.delivery_fee_cents > 0 && (
            <TotalRow label="Delivery" amount={quote.delivery_fee_cents} currency={quote.currency} />
          )}
          {quote.tax_cents > 0 && (
            <TotalRow label="Tax" amount={quote.tax_cents} currency={quote.currency} />
          )}
          {quote.gratuity_cents > 0 && (
            <TotalRow label="Gratuity" amount={quote.gratuity_cents} currency={quote.currency} />
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px solid #e4e4e7',
              fontSize: 17,
              fontWeight: 700,
            }}
          >
            <span>Total</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(quote.total_cents, quote.currency)}
            </span>
          </div>
        </div>

        {quote.notes ? (
          <div
            style={{
              padding: '16px 28px',
              borderTop: '1px solid #e4e4e7',
              background: '#fafafa',
              fontSize: 14,
              color: '#52525b',
              whiteSpace: 'pre-wrap',
            }}
          >
            <div style={{ fontWeight: 600, color: '#18181b', marginBottom: 4 }}>Notes</div>
            {quote.notes}
          </div>
        ) : null}

        <div style={{ padding: '24px 28px 28px', borderTop: '1px solid #e4e4e7' }}>
          {accepted ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#dcfce7',
                color: '#166534',
                padding: '14px 16px',
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              <Check style={{ width: 18, height: 18 }} />
              Quote accepted — thanks! We&apos;ll follow up with next steps shortly.
            </div>
          ) : quote.status === 'declined' ? (
            <div
              style={{
                background: '#fef3c7',
                color: '#92400e',
                padding: '14px 16px',
                borderRadius: 8,
              }}
            >
              This quote has been declined.
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onAccept}
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
                {isPending ? 'Accepting…' : 'Accept quote'}
              </button>
              {error ? (
                <p style={{ marginTop: 10, color: '#b91c1c', fontSize: 13 }}>{error}</p>
              ) : null}
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: '#71717a',
                  textAlign: 'center',
                }}
              >
                Questions? Reply to the email we sent.
              </p>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          textAlign: 'center',
          fontSize: 11,
          color: '#a1a1aa',
        }}
      >
        Powered by CaterOS
      </div>
    </div>
  );
}

function TotalRow({
  label,
  amount,
  currency,
}: {
  label: string;
  amount: number;
  currency: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#52525b' }}>
      <span>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
        {amount < 0 ? '−' : ''}
        {formatMoney(Math.abs(amount), currency)}
      </span>
    </div>
  );
}
