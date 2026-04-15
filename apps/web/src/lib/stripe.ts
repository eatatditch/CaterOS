import 'server-only';
import Stripe from 'stripe';

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'Missing STRIPE_SECRET_KEY. Set it in Vercel → Settings → Environment Variables.',
    );
  }
  return new Stripe(key, {
    // Pin an API version so future Stripe changes don't silently affect us.
    apiVersion: '2026-03-25.dahlia',
    typescript: true,
    appInfo: { name: 'CaterOS', version: '0.1.0' },
  });
}

export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  );
}
