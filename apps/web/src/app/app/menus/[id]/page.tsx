import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { buttonOutlineCls } from '@/components/ui/field';
import { NewMenuItemForm } from './new-menu-item-form';
import { MenuItemRow } from './menu-item-row';
import { CategoriesPanel } from './categories-panel';

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

  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name, position')
    .eq('menu_id', id)
    .order('position');

  const categoryIds = (categories ?? []).map((c) => c.id);

  const { data: items } = await supabase
    .from('menu_items')
    .select(
      'id, name, description, unit, unit_price_cents, unit_cost_cents, min_quantity, is_active, category_id',
    )
    .in('category_id', categoryIds.length > 0 ? categoryIds : ['00000000-0000-0000-0000-000000000000'])
    .order('name');

  // org-level modifier groups + which ones are attached to each item
  const itemIds = (items ?? []).map((it) => it.id);
  const [{ data: modifierGroups }, { data: links }] = await Promise.all([
    supabase.from('modifier_groups').select('id, name').order('name'),
    itemIds.length > 0
      ? supabase
          .from('menu_item_modifier_groups')
          .select('menu_item_id, modifier_group_id')
          .in('menu_item_id', itemIds)
      : Promise.resolve({ data: [] as { menu_item_id: string; modifier_group_id: string }[] }),
  ]);

  const attachedByItem = new Map<string, string[]>();
  for (const l of links ?? []) {
    const arr = attachedByItem.get(l.menu_item_id) ?? [];
    arr.push(l.modifier_group_id);
    attachedByItem.set(l.menu_item_id, arr);
  }

  const allItems = items ?? [];
  // group items by category, preserving category order; uncategorized last
  const itemsByCategory = (categories ?? []).map((c) => ({
    category: c,
    items: allItems.filter((it) => it.category_id === c.id),
  }));
  const uncategorized = allItems.filter((it) => !it.category_id);

  const categoriesWithCounts = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    itemCount: allItems.filter((it) => it.category_id === c.id).length,
  }));

  const renderRow = (it: (typeof allItems)[number]) => (
    <MenuItemRow
      key={it.id}
      menuId={id}
      modifierGroups={modifierGroups ?? []}
      attachedGroupIds={attachedByItem.get(it.id) ?? []}
      item={{
        id: it.id,
        name: it.name,
        description: it.description,
        unit: it.unit,
        min_quantity: it.min_quantity,
        price: formatMoney(it.unit_price_cents, ctx.org.currency),
        cost: formatMoney(it.unit_cost_cents, ctx.org.currency),
        margin:
          it.unit_price_cents > 0
            ? Math.round(((it.unit_price_cents - it.unit_cost_cents) / it.unit_price_cents) * 100)
            : 0,
      }}
    />
  );

  return (
    <div className="container py-8">
      <Link
        href="/app/menus"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to menus
      </Link>
      <PageHeader
        title={menu.name}
        description={menu.description ?? undefined}
        actions={
          <Link href="/app/menus/modifiers" className={buttonOutlineCls}>
            <SlidersHorizontal className="h-4 w-4" /> Modifiers
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border bg-card">
          <header className="border-b px-6 py-4">
            <h2 className="font-semibold">Items ({allItems.length})</h2>
          </header>
          {allItems.length > 0 ? (
            <div>
              {itemsByCategory.map(({ category, items: catItems }) => (
                <div key={category.id}>
                  <div className="bg-muted/40 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {category.name} ({catItems.length})
                  </div>
                  {catItems.length > 0 ? (
                    <ul className="divide-y">{catItems.map(renderRow)}</ul>
                  ) : (
                    <p className="px-6 py-3 text-sm text-muted-foreground">No items.</p>
                  )}
                </div>
              ))}
              {uncategorized.length > 0 ? (
                <div>
                  <div className="bg-muted/40 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Uncategorized ({uncategorized.length})
                  </div>
                  <ul className="divide-y">{uncategorized.map(renderRow)}</ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No items yet — add one on the right →
            </div>
          )}
        </section>

        <div className="space-y-6">
          <aside className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 font-semibold">Add item</h3>
            <NewMenuItemForm
              menuId={id}
              categories={(categories ?? []).map((c) => ({ id: c.id, name: c.name }))}
            />
          </aside>

          <aside className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 font-semibold">Categories</h3>
            <CategoriesPanel menuId={id} categories={categoriesWithCounts} />
          </aside>
        </div>
      </div>
    </div>
  );
}
