import Link from 'next/link';
import { ArrowLeft, MapPin, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { NewLocationForm } from './new-location-form';
import { LocationRow } from './location-row';

export default async function LocationsPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from('locations')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('is_default', { ascending: false })
    .order('created_at');

  const canEdit = ctx.role === 'owner' || ctx.role === 'manager';

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href="/app/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to settings
      </Link>

      <PageHeader
        title="Locations"
        description="Each location can have its own default timezone, kitchen address, and dispatch zone. Events and dispatch can be filtered by location."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">
              {locations?.length ?? 0} {locations?.length === 1 ? 'location' : 'locations'}
            </h2>
          </header>
          {locations && locations.length > 0 ? (
            <ul className="divide-y">
              {locations.map((l) => (
                <LocationRow key={l.id} location={l} canEdit={canEdit} />
              ))}
            </ul>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={MapPin}
                title="No locations yet"
                description="Add your first kitchen or service location."
              />
            </div>
          )}
        </section>

        {canEdit ? (
          <aside className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Plus className="h-4 w-4" /> Add location
            </h3>
            <NewLocationForm />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
