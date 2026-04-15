import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { CompanyForm } from '../company-form';

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();
  const { data: company } = await supabase.from('companies').select('*').eq('id', id).maybeSingle();
  if (!company) notFound();

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, job_title')
    .eq('company_id', id)
    .order('last_name');

  return (
    <div className="container py-8">
      <Link
        href="/app/companies"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>
      <PageHeader title={company.name} description={company.industry ?? undefined} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-6 lg:col-span-2">
          <CompanyForm initial={company} />
        </section>
        <aside className="rounded-lg border bg-card p-4 text-sm">
          <div className="mb-2 font-semibold">People ({contacts?.length ?? 0})</div>
          {contacts && contacts.length > 0 ? (
            <ul className="space-y-1">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/app/contacts/${c.id}`}
                    className="block rounded px-2 py-1 hover:bg-accent"
                  >
                    <div className="font-medium">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.job_title ?? c.email ?? ''}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No contacts linked.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
