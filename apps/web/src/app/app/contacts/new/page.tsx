import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { ContactForm } from '../contact-form';

export default async function NewContactPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .order('name')
    .limit(500);

  return (
    <div className="container max-w-2xl py-8">
      <Link
        href="/app/contacts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to contacts
      </Link>
      <PageHeader title="New contact" description="Add a new contact to your CRM." />
      <div className="rounded-lg border bg-card p-6">
        <ContactForm companies={companies ?? []} />
      </div>
    </div>
  );
}
