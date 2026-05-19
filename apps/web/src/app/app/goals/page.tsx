import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { GoalForm } from './goal-form';
import { GoalsList } from './goals-list';

export const dynamic = 'force-dynamic';

export default async function GoalsPage() {
  const ctx = await requirePermission('org.manage');
  const supabase = await createClient();

  const [{ data: goals }, { data: members }, { data: locations }] = await Promise.all([
    supabase
      .from('goals')
      .select('*')
      .order('period_start', { ascending: false })
      .order('owner_id'),
    supabase
      .from('memberships')
      .select('user_id, role, profiles:user_id (full_name)')
      .eq('org_id', ctx.org.id),
    supabase.from('locations').select('id, name').order('name'),
  ]);

  const managers = (members ?? []).map((m) => ({
    id: m.user_id,
    name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? '(no name)',
    role: m.role,
  }));

  return (
    <div className="container py-8">
      <PageHeader
        title="Goals"
        description="Per-manager and per-location revenue and activity targets."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-6 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Set a goal</h2>
          <GoalForm managers={managers} locations={locations ?? []} />
        </section>
        <section className="rounded-lg border bg-card lg:col-span-3">
          <h2 className="border-b px-6 py-4 font-semibold">Current goals</h2>
          <GoalsList
            goals={goals ?? []}
            managers={managers}
            locations={locations ?? []}
            currency={ctx.org.currency}
          />
        </section>
      </div>
    </div>
  );
}
