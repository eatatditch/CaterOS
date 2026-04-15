import Link from 'next/link';
import { Plus, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { buttonPrimaryCls } from '@/components/ui/field';

type ContactRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  lifecycle_stage: string;
  created_at: string;
  companies: { id: string; name: string } | null;
};

export default async function ContactsPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, phone, job_title, lifecycle_stage, created_at, companies:company_id (id, name)')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as ContactRow[];

  const columns: Column<ContactRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (r) => (
        <div className="font-medium">
          {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (r) => <span className="text-muted-foreground">{r.email ?? '—'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (r) => <span className="text-muted-foreground">{r.phone ?? '—'}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      render: (r) => <span className="text-muted-foreground">{r.companies?.name ?? '—'}</span>,
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (r) => <StatusBadge label={r.lifecycle_stage.replace('_', ' ')} tone="blue" />,
    },
  ];

  return (
    <div className="container py-8">
      <PageHeader
        title="Contacts"
        description={`${rows.length} ${rows.length === 1 ? 'contact' : 'contacts'} in your CRM`}
        actions={
          <Link href="/app/contacts/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" />
            New contact
          </Link>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowHref={(r) => `/app/contacts/${r.id}`}
        emptyState={
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Contacts are the people you do business with — add your first one to start tracking emails, quotes, and events."
            action={
              <Link href="/app/contacts/new" className={buttonPrimaryCls}>
                <Plus className="h-4 w-4" />
                Add contact
              </Link>
            }
          />
        }
      />
    </div>
  );
}
