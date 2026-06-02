import { CheckCircle2, CreditCard, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DepositAmountForm } from './deposit-amount-form';

const DEFAULT_DEPOSIT_CENTS = 50_000; // $500

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();

  const settings = (org?.settings as Record<string, unknown> | null) ?? {};
  const depositCents =
    typeof settings.deposit_cents === 'number'
      ? settings.deposit_cents
      : DEFAULT_DEPOSIT_CENTS;
  const autoChargeEnabled =
    typeof settings.auto_charge_enabled === 'boolean' ? settings.auto_charge_enabled : true;

  const hasStripe = Boolean(
    process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET,
  );
  const canEdit = ctx.role === 'owner' || ctx.role === 'manager';

  return (
    <div className="container max-w-3xl py-8">
      <PageHeader
        title="Billing"
        description="Deposit rate, Stripe connection, and payment defaults."
      />

      <div className="space-y-6">
        {/* Stripe status */}
        <section className="rounded-lg border bg-card p-6">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Stripe</h2>
              <p className="text-xs text-muted-foreground">
                Card processing for deposits and balances.
              </p>
            </div>
            {hasStripe ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">
                <AlertCircle className="h-3.5 w-3.5" /> Not configured
              </span>
            )}
          </div>

          {hasStripe ? (
            <p className="text-sm text-muted-foreground">
              Deposits collected via Stripe Checkout. Confirmed payments mark the invoice
              as partially paid / paid automatically.
            </p>
          ) : (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-900">
              Add these env vars in Vercel to enable deposits:
              <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-xs">
                <li>STRIPE_SECRET_KEY</li>
                <li>STRIPE_WEBHOOK_SECRET</li>
                <li>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</li>
              </ul>
            </div>
          )}
        </section>

        {/* Deposit amount */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 font-semibold">Default deposit</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Flat dollar amount charged as a deposit when a client accepts a quote.
            A per-quote deposit set in the quote builder overrides this. The deposit is
            capped at the quote total, and existing invoices aren&apos;t affected.
          </p>
          <DepositAmountForm
            initialCents={depositCents}
            autoChargeEnabled={autoChargeEnabled}
            canEdit={canEdit}
          />
        </section>

        {/* Future */}
        <section className="rounded-lg border bg-card p-6 opacity-70">
          <h2 className="mb-2 font-semibold">Coming soon</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Accept ACH transfers (lower fees)</li>
            <li>• Sync paid invoices to QuickBooks Online / Xero</li>
            <li>• 1099 / catering-tax reports</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
