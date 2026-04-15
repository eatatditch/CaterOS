import Link from 'next/link';
import { Building2, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, type Column } from '@/components/ui/data-table';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonPrimaryCls } from '@/components/ui/field';

type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  city: string | null;
  region: string | null;
  website: string | null;
};

export default async function CompaniesPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('companies')
    .select('id, name, industry, city, region, website')
    .order('name')
    .limit(200);
  const rows = (data ?? []) as CompanyRow[];

  const columns: Column<CompanyRow>[] = [
    { key: 'name', header: 'Company', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'industry', header: 'Industry', render: (r) => r.industry ?? '—' },
    {
      key: 'loc',
      header: 'Location',
      render: (r) => [r.city, r.region].filter(Boolean).join(', ') || '—',
    },
    {
      key: 'web',
      header: 'Website',
      render: (r) => (r.website ? <span className="text-muted-foreground">{r.website}</span> : '—'),
    },
  ];

  return (
    <div className="container py-8">
      <PageHeader
        title="Companies"
        description={`${rows.length} ${rows.length === 1 ? 'company' : 'companies'}`}
        actions={
          <Link href="/app/companies/new" className={buttonPrimaryCls}>
            <Plus className="h-4 w-4" /> New company
          </Link>
        }
      />
      <DataTable
        rows={rows}
        columns={columns}
        rowHref={(r) => `/app/companies/${r.id}`}
        emptyState={
          <EmptyState
            icon={Building2}
            title="No companies yet"
            description="Track the organizations you sell to — link contacts, deals, and events to them."
            action={
              <Link href="/app/companies/new" className={buttonPrimaryCls}>
                <Plus className="h-4 w-4" /> Add company
              </Link>
            }
          />
        }
      />
    </div>
  );
}
