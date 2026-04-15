import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { InviteForm } from './invite-form';
import { MemberRow } from './member-row';
import { InvitationRow } from './invitation-row';

export default async function TeamPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from('memberships')
      .select('role, user_id, created_at, profiles:user_id (id, full_name)')
      .eq('org_id', ctx.org.id),
    supabase
      .from('invitations')
      .select('id, email, role, token, expires_at, created_at')
      .eq('org_id', ctx.org.id)
      .is('accepted_at', null)
      .order('created_at', { ascending: false }),
  ]);

  const canManage = ctx.role === 'owner' || ctx.role === 'manager';

  return (
    <div className="container max-w-5xl py-8">
      <Link
        href="/app/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to settings
      </Link>
      <PageHeader
        title="Team"
        description="Invite teammates and set per-user permissions."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-lg border bg-card">
            <header className="border-b px-6 py-4">
              <h2 className="font-semibold">
                Members ({members?.length ?? 0})
              </h2>
            </header>
            <ul className="divide-y">
              {(members ?? []).map((m) => (
                <MemberRow
                  key={m.user_id}
                  member={{
                    userId: m.user_id,
                    role: m.role,
                    fullName:
                      (m.profiles as unknown as { full_name: string | null } | null)?.full_name ??
                      '(no name)',
                  }}
                  currentUserId={ctx.user.id}
                  currentRole={ctx.role}
                  canManage={canManage}
                />
              ))}
            </ul>
          </section>

          {invitations && invitations.length > 0 ? (
            <section className="rounded-lg border bg-card">
              <header className="border-b px-6 py-4">
                <h2 className="font-semibold">Pending invitations ({invitations.length})</h2>
              </header>
              <ul className="divide-y">
                {invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    invitation={inv}
                    canManage={canManage}
                  />
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {canManage ? (
          <aside className="rounded-lg border bg-card p-5">
            <h3 className="mb-3 font-semibold">Invite a teammate</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              We&apos;ll email them a magic link. When they sign up they&apos;ll join {ctx.org.name} at
              the role you pick.
            </p>
            <InviteForm currentRole={ctx.role} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
