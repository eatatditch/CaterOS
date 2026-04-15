import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EventForm } from '../event-form';

export default async function NewEventPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .order('last_name')
    .limit(500);

  return (
    <div className="container max-w-3xl py-8">
      <Link
        href="/app/events"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to events
      </Link>
      <PageHeader title="New event" />
      <div className="rounded-lg border bg-card p-6">
        <EventForm
          contacts={(contacts ?? []).map((c) => ({
            id: c.id,
            label: [c.first_name, c.last_name].filter(Boolean).join(' '),
          }))}
        />
      </div>
    </div>
  );
}
