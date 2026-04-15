import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { QuoteBuilder } from '../quote-builder';

export default async function NewQuotePage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const [{ data: contacts }, { data: menuItems }] = await Promise.all([
    supabase.from('contacts').select('id, first_name, last_name').order('last_name').limit(500),
    supabase
      .from('menu_items')
      .select('id, name, description, unit_price_cents, unit')
      .eq('is_active', true)
      .order('name')
      .limit(500),
  ]);

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href="/app/quotes"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to quotes
      </Link>
      <PageHeader title="New quote" description="Build a quote from your menu." />
      <QuoteBuilder
        currency={ctx.org.currency}
        contacts={(contacts ?? []).map((c) => ({
          id: c.id,
          label: [c.first_name, c.last_name].filter(Boolean).join(' ') || '(no name)',
        }))}
        menuItems={(menuItems ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description ?? null,
          unit_price_cents: m.unit_price_cents,
          unit: m.unit,
        }))}
      />
    </div>
  );
}
