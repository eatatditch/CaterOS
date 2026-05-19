import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { ProspectForm } from '../prospect-form';

export default async function NewProspectPage() {
  await requirePermission('deals.manage');
  const supabase = await createClient();
  const { data: locations } = await supabase.from('locations').select('id, name').order('name');

  return (
    <div className="container max-w-2xl py-8">
      <Link
        href="/app/prospects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to prospects
      </Link>
      <PageHeader title="New prospect" description="Track an outbound target before it becomes a lead." />
      <div className="rounded-lg border bg-card p-6">
        <ProspectForm locations={locations ?? []} />
      </div>
    </div>
  );
}
