import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SetPasswordForm } from './set-password-form';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invitation } = await admin
    .from('invitations')
    .select(
      'id, org_id, email, role, expires_at, accepted_at, orgs:org_id (id, name)',
    )
    .eq('token', token)
    .maybeSingle();

  if (!invitation) {
    return (
      <InviteShell
        title="Invitation not found"
        body="This invite link is invalid or has been revoked. Ask the person who invited you to send a new one."
      />
    );
  }

  const orgName = (invitation.orgs as unknown as { name: string } | null)?.name ?? 'your org';
  const expired = new Date(invitation.expires_at).getTime() < Date.now();

  if (expired) {
    return (
      <InviteShell
        title="Invitation expired"
        body={`This invitation to join ${orgName} has expired. Ask the person who invited you to send a new one.`}
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in: point them at signup where they'll set email/password and
  // the handle_new_user trigger will attach them to this invite automatically.
  if (!user) {
    return (
      <InviteShell
        title={`You're invited to ${orgName}`}
        body={`Create an account for ${invitation.email} to accept this invitation.`}
        cta={
          <Link
            href={`/signup?email=${encodeURIComponent(invitation.email)}&invite=${token}`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 font-medium text-primary-foreground hover:opacity-90"
          >
            Create account
          </Link>
        }
        extra={
          <Link
            href={`/login?next=/invite/${token}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Already have an account? Log in
          </Link>
        }
      />
    );
  }

  if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
    return (
      <InviteShell
        title="Signed in as a different user"
        body={`This invitation is for ${invitation.email}. You're signed in as ${user.email}. Sign out and try again.`}
        cta={
          <Link
            href="/login"
            className="inline-flex h-10 items-center justify-center rounded-md border px-6 font-medium hover:bg-accent"
          >
            Sign in as different user
          </Link>
        }
      />
    );
  }

  // Signed in with matching email. Show set-password form. The action will
  // set the password, upsert membership, mark invitation accepted, and
  // redirect to /app/welcome so the user can fill in name & phone.
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <ChefHat className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold">Welcome to {orgName}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Set a password for <span className="font-medium text-foreground">{invitation.email}</span> so you
            can log in next time.
          </p>
        </div>
        <SetPasswordForm token={token} />
      </div>
    </div>
  );
}

function InviteShell({
  title,
  body,
  cta,
  extra,
}: {
  title: string;
  body: string;
  cta?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <ChefHat className="mx-auto mb-4 h-8 w-8 text-primary" />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {cta ? <div className="mt-6">{cta}</div> : null}
        {extra ? <div className="mt-4">{extra}</div> : null}
      </div>
    </div>
  );
}
