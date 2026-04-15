import { CheckCircle2, CreditCard, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DepositRateForm } from './deposit-rate-form';

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
  const depositRate =
    typeof settings.deposit_rate === 'number' ? settings.deposit_rate : 0.25;

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

        {/* Deposit rate */}
        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-2 font-semibold">Default deposit</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Percentage of the quote total charged as a deposit when the client accepts.
            Applied to every future accepted quote — existing invoices aren&apos;t affected.
          </p>
          <DepositRateForm initial={depositRate} canEdit={canEdit} />
        </section>

        {/* Future */}
        <section className="rounded-lg border bg-card p-6 opacity-70">
          <h2 className="mb-2 font-semibold">Coming soon</h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• Auto-charge balance due on event date</li>
            <li>• Accept ACH transfers (lower fees)</li>
            <li>• Sync paid invoices to QuickBooks Online / Xero</li>
            <li>• 1099 / catering-tax reports</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
