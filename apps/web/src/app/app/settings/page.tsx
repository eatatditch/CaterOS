import Link from 'next/link';
import { MapPin, Users2, Building2, ArrowRight, Plug } from 'lucide-react';
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

  const [{ count: memberCount }, { count: locationCount }] = await Promise.all([
    supabase
      .from('memberships')
      .select('user_id', { count: 'exact', head: true })
      .eq('org_id', ctx.org.id),
    supabase
      .from('locations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', ctx.org.id),
  ]);

  return (
    <div className="container max-w-5xl py-8">
      <PageHeader title="Settings" description="Organization, team, and locations." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Link
          href="/app/settings/team"
          className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <Users2 className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold group-hover:text-primary">Team</div>
              <div className="text-xs text-muted-foreground">
                {memberCount ?? 0} {memberCount === 1 ? 'member' : 'members'} · invite, change roles
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </Link>
        <Link
          href="/app/settings/locations"
          className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm"
        >
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold group-hover:text-primary">Locations</div>
              <div className="text-xs text-muted-foreground">
                {locationCount ?? 0}{' '}
                {locationCount === 1 ? 'location' : 'locations'} · kitchens, dispatch zones
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </Link>
        <Link
          href="/app/settings/integrations"
          className="group flex items-center justify-between rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm sm:col-span-2"
        >
          <div className="flex items-center gap-3">
            <Plug className="h-6 w-6 text-primary" />
            <div>
              <div className="font-semibold group-hover:text-primary">Integrations</div>
              <div className="text-xs text-muted-foreground">
                Gmail, Stripe, Twilio, Slack · send &amp; receive from CaterOS
              </div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
        </Link>
      </div>

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Organization</h2>
        </div>
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
    </div>
  );
}
