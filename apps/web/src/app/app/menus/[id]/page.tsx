import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { NewMenuItemForm } from './new-menu-item-form';
import { MenuItemRow } from './menu-item-row';

export default async function MenuDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireCurrent();
  const { id } = await params;
  const supabase = await createClient();

  const { data: menu } = await supabase.from('menus').select('*').eq('id', id).maybeSingle();
  if (!menu) notFound();

  const { data: items } = await supabase
    .from('menu_items')
    .select('id, name, description, unit, unit_price_cents, unit_cost_cents, min_quantity, is_active')
    .in('category_id', [
      ...((
        await supabase.from('menu_categories').select('id').eq('menu_id', id)
      ).data?.map((c) => c.id) ?? []),
    ])
    .order('name');

  return (
    <div className="container py-8">
      <Link
        href="/app/menus"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to menus
      </Link>
      <PageHeader title={menu.name} description={menu.description ?? undefined} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">
              Items ({items?.length ?? 0})
            </h2>
          </header>
          {items && items.length > 0 ? (
            <ul className="divide-y">
              {items.map((it) => (
                <MenuItemRow
                  key={it.id}
                  menuId={id}
                  item={{
                    ...it,
                    price: formatMoney(it.unit_price_cents, ctx.org.currency),
                    cost: formatMoney(it.unit_cost_cents, ctx.org.currency),
                    margin:
                      it.unit_price_cents > 0
                        ? Math.round(
                            ((it.unit_price_cents - it.unit_cost_cents) / it.unit_price_cents) * 100,
                          )
                        : 0,
                  }}
                />
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No items yet — add one on the right →
            </div>
          )}
        </section>

        <aside className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 font-semibold">Add item</h3>
          <NewMenuItemForm menuId={id} />
        </aside>
      </div>
    </div>
  );
}
