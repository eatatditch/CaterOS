import Link from 'next/link';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { formatMoney } from '@cateros/lib/money';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { NewModifierGroupForm } from './new-modifier-group-form';
import { ModifierGroupCard } from './modifier-group-card';

export default async function ModifiersPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const [{ data: groups }, { data: modifiers }] = await Promise.all([
    supabase
      .from('modifier_groups')
      .select('id, name, is_required, min_selections, max_selections')
      .order('name'),
    supabase
      .from('modifiers')
      .select('id, group_id, name, price_delta_cents, position')
      .order('position'),
  ]);

  const modsByGroup = new Map<
    string,
    { id: string; name: string; price_delta_cents: number; price: string }[]
  >();
  for (const m of modifiers ?? []) {
    const arr = modsByGroup.get(m.group_id) ?? [];
    arr.push({
      id: m.id,
      name: m.name,
      price_delta_cents: m.price_delta_cents,
      price: formatMoney(m.price_delta_cents, ctx.org.currency),
    });
    modsByGroup.set(m.group_id, arr);
  }

  return (
    <div className="container py-8">
      <Link
        href="/app/menus"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to menus
      </Link>
      <PageHeader
        title="Modifier groups"
        description="Reusable option groups (e.g. “Choose 1 entrée”) you can attach to menu items."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {groups && groups.length > 0 ? (
            groups.map((g) => (
              <ModifierGroupCard
                key={g.id}
                group={g}
                modifiers={modsByGroup.get(g.id) ?? []}
              />
            ))
          ) : (
            <EmptyState
              icon={SlidersHorizontal}
              title="No modifier groups yet"
              description="Create a modifier group on the right, then attach it to menu items."
            />
          )}
        </div>

        <aside className="rounded-lg border bg-card p-5">
          <h3 className="mb-3 font-semibold">New modifier group</h3>
          <NewModifierGroupForm />
        </aside>
      </div>
    </div>
  );
}
