import { Receipt } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge, invoiceStatusTone } from '@/components/ui/status-badge';
import { formatDate } from '@/lib/utils';

type Row = {
  id: string;
  number: string;
  status: string;
  total_cents: number;
  amount_paid_cents: number;
  currency: string;
  due_at: string | null;
  issued_at: string | null;
  contacts: { first_name: string | null; last_name: string | null } | null;
};

export default async function InvoicesPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('invoices')
    .select(
      'id, number, status, total_cents, amount_paid_cents, currency, due_at, issued_at, contacts:contact_id (first_name, last_name)',
    )
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];

  const totalOpen = rows
    .filter((r) => r.status === 'open' || r.status === 'past_due' || r.status === 'partially_paid')
    .reduce((sum, r) => sum + (r.total_cents - r.amount_paid_cents), 0);

  const columns: Column<Row>[] = [
    { key: 'number', header: 'Invoice', render: (r) => <span className="font-medium">{r.number}</span> },
    {
      key: 'contact',
      header: 'Billed to',
      render: (r) =>
        r.contacts
          ? [r.contacts.first_name, r.contacts.last_name].filter(Boolean).join(' ') || '—'
          : '—',
    },
    { key: 'issued', header: 'Issued', render: (r) => (r.issued_at ? formatDate(r.issued_at) : '—') },
    { key: 'due', header: 'Due', render: (r) => (r.due_at ? formatDate(r.due_at) : '—') },
    {
      key: 'total',
      header: 'Total',
      render: (r) => <span className="tabular-nums">{formatMoney(r.total_cents, r.currency)}</span>,
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (r) => (
        <span className="tabular-nums">
          {formatMoney(r.total_cents - r.amount_paid_cents, r.currency)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge label={r.status.replace('_', ' ')} tone={invoiceStatusTone(r.status)} />,
    },
  ];

  return (
    <div className="container py-8">
      <PageHeader
        title="Invoices"
        description={
          rows.length > 0
            ? `${rows.length} invoices · ${formatMoney(totalOpen, rows[0]?.currency ?? 'USD')} outstanding`
            : 'No invoices yet'
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        emptyState={
          <EmptyState
            icon={Receipt}
            title="No invoices yet"
            description="Convert an accepted quote into an invoice to start collecting payments. Stripe integration coming in Phase 5."
          />
        }
      />
    </div>
  );
}
