import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { OrgSettingsForm } from './org-settings-form';

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
];

export default async function SettingsPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const { data: members } = await supabase
    .from('memberships')
    .select('role, user_id, profiles:user_id (full_name), created_at')
    .eq('org_id', ctx.org.id);

  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, city, region, is_default')
    .eq('org_id', ctx.org.id)
    .order('is_default', { ascending: false });

  return (
    <div className="container max-w-4xl py-8">
      <PageHeader title="Settings" description="Organization, team, and locations." />

      <section className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">Organization</h2>
        <OrgSettingsForm
          initial={{
            name: ctx.org.name,
            timezone: ctx.org.timezone,
            currency: ctx.org.currency,
          }}
          timezones={timezones}
          canEdit={ctx.role === 'owner' || ctx.role === 'manager'}
        />
      </section>

      <section className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">Team ({members?.length ?? 0})</h2>
        <ul className="divide-y">
          {(members ?? []).map((m) => {
            const name =
              (m.profiles as unknown as { full_name: string | null } | null)?.full_name ??
              '(no name)';
            return (
              <li
                key={m.user_id}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="font-medium">{name}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {m.role.replace('_', ' ')}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Invite flow with magic links is shipping in Phase 7.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 font-semibold">Locations ({locations?.length ?? 0})</h2>
        <ul className="divide-y">
          {(locations ?? []).map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium">{l.name}</span>
                {l.is_default && (
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    default
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {[l.city, l.region].filter(Boolean).join(', ') || '—'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
