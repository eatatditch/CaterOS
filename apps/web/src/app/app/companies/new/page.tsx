import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { CompanyForm } from '../company-form';

export default async function NewCompanyPage() {
  await requireCurrent();
  return (
    <div className="container max-w-2xl py-8">
      <Link
        href="/app/companies"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>
      <PageHeader title="New company" />
      <div className="rounded-lg border bg-card p-6">
        <CompanyForm />
      </div>
    </div>
  );
}
