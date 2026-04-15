/** Money is always stored as integer cents. */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatMoney(cents: number, currency = 'USD', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(fromCents(cents));
}

export function sumCents(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/**
 * Compute taxes/fees on a subtotal in cents.
 * Rates are decimals (0.0875 = 8.75%).
 */
export function computeQuoteTotals(args: {
  subtotalCents: number;
  taxRate?: number;
  serviceFeeRate?: number;
  deliveryFeeCents?: number;
  gratuityRate?: number;
  discountCents?: number;
}) {
  const {
    subtotalCents,
    taxRate = 0,
    serviceFeeRate = 0,
    deliveryFeeCents = 0,
    gratuityRate = 0,
    discountCents = 0,
  } = args;

  const discounted = Math.max(0, subtotalCents - discountCents);
  const serviceFeeCents = Math.round(discounted * serviceFeeRate);
  const taxCents = Math.round((discounted + serviceFeeCents) * taxRate);
  const gratuityCents = Math.round(discounted * gratuityRate);
  const totalCents = discounted + serviceFeeCents + taxCents + deliveryFeeCents + gratuityCents;

  return {
    subtotalCents,
    discountCents,
    serviceFeeCents,
    taxCents,
    deliveryFeeCents,
    gratuityCents,
    totalCents,
  };
}
