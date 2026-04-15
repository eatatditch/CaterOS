import Link from 'next/link';
import { Plus, Utensils } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonPrimaryCls } from '@/components/ui/field';
import { NewMenuForm } from './new-menu-form';

export default async function MenusPage() {
  await requireCurrent();
  const supabase = await createClient();
  const { data: menus } = await supabase
    .from('menus')
    .select('id, name, description, is_active, created_at')
    .order('created_at', { ascending: false });

  return (
    <div className="container py-8">
      <PageHeader
        title="Menus"
        description={`${menus?.length ?? 0} ${menus?.length === 1 ? 'menu' : 'menus'}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {menus && menus.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {menus.map((m) => (
                <Link
                  key={m.id}
                  href={`/app/menus/${m.id}`}
                  className="rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm"
                >
                  <Utensils className="mb-3 h-5 w-5 text-primary" />
                  <div className="font-semibold">{m.name}</div>
                  <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {m.description ?? 'No description'}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Utensils}
              title="No menus yet"
              description="Create your first menu to build reusable catalogs for quoting and events."
            />
          )}
        </div>

        <aside className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" /> New menu
          </h3>
          <NewMenuForm />
        </aside>
      </div>
    </div>
  );
}
