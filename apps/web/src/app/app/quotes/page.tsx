import Link from 'next/link';
import { ClipboardList, Plus } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge, quoteStatusTone } from '@/components/ui/status-badge';
import { buttonPrimaryCls } from '@/components/ui/field';
import { formatDate } from '@/lib/utils';

type QuoteRow = {
  id: string;
  number: string;
  status: string;
  headcount: number;
  event_date: string | null;
  total_cents: number;
  currency: string;
  created_at: string;
  contacts: { first_name: string | null; last_name: string | null } | null;
};

export default async function QuotesPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('quotes')
    .select(
      'id, number, status, headcount, event_date, total_cents, currency, created_at, contacts:contact_id (first_name, last_name)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as QuoteRow[];

  const columns: Column<QuoteRow>[] = [
    { key: 'number', header: 'Number', render: (r) => <span className="font-medium">{r.number}</span> },
    {
      key: 'contact',
      header: 'Contact',
      render: (r) =>
        r.contacts
          ? [r.contacts.first_name, r.contacts.last_name].filter(Boolean).join(' ') || '—'
          : '—',
    },
    {
      key: 'date',
      header: 'Event date',
      render: (r) => (r.event_date ? formatDate(r.event_date) : '—'),
    },
    { key: 'hc', header: 'Head count', render: (r) => r.headcount },
    {
      key: 'total',
      header: 'Total',
      render: (r) => <span className="font-medium">{formatMoney(r.total_cents, r.currency)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge label={r.status} tone={quoteStatusTone(r.status)} />,
    },
  ];

  return (
    <div className="container py-8">
      <PageHeader
        title="Quotes"
        description={`${rows.length} ${rows.length === 1 ? 'quote' : 'quotes'}`}
        actions={
          <Link href="/app/quotes/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New quote
          </Link>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowHref={(r) => `/app/quotes/${r.id}`}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title="No quotes yet"
            description="Build a quote from your menu catalog — your client can view, accept, and pay a deposit from a public link."
            action={
              <Link href="/app/quotes/new" className={buttonPrimaryCls}>
                <Plus className="h-4 w-4" /> New quote
              </Link>
            }
          />
        }
      />
    </div>
  );
}
