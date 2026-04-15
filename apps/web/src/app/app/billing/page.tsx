import { CreditCard, CheckCircle2, Circle } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';

const checklist = [
  { label: 'Connect Stripe account', done: false },
  { label: 'Configure tax rates', done: false },
  { label: 'Set default deposit %', done: false },
  { label: 'Enable ACH payments', done: false },
  { label: 'Accounting sync (QuickBooks / Xero)', done: false },
];

export default async function BillingPage() {
  const ctx = await requireCurrent();
  return (
    <div className="container max-w-3xl py-8">
      <PageHeader title="Billing" description="Connect your payment stack and configure defaults." />

      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Payments setup for {ctx.org.name}</h3>
        </div>
        <ul className="space-y-3">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-3 text-sm">
              {c.done ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span className={c.done ? 'text-muted-foreground line-through' : ''}>{c.label}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-md bg-muted/40 p-4 text-sm text-muted-foreground">
          Stripe Connect integration ships in Phase 5. Once live, you&apos;ll be able to capture
          deposits, auto-charge balances on a schedule, issue refunds, and reconcile payouts here.
        </p>
      </div>
    </div>
  );
}
