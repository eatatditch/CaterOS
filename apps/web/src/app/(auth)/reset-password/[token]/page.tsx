import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { ResetPasswordForm } from './reset-password-form';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();
  const { data: reset } = await admin
    .from('password_resets')
    .select('expires_at, used_at, email')
    .eq('token', token)
    .maybeSingle();

  const invalid = !reset;
  const expired = reset ? new Date(reset.expires_at).getTime() < Date.now() : false;
  const used = Boolean(reset?.used_at);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <Link href="/" className="mb-6 flex items-center gap-2">
          <ChefHat className="h-6 w-6 text-primary" />
          <span className="font-bold">CaterOS</span>
        </Link>

        {invalid ? (
          <>
            <h1 className="text-xl font-semibold">Link not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This reset link is invalid. Request a new one below.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Send a new link
            </Link>
          </>
        ) : expired || used ? (
          <>
            <h1 className="text-xl font-semibold">
              {used ? 'Link already used' : 'Link expired'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {used
                ? 'This reset link has already been used. Request a new one if you need to reset again.'
                : 'This reset link has expired. Request a new one.'}
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Send a new link
            </Link>
          </>
        ) : (
          <>
            <h1 className="mb-2 text-2xl font-semibold">Choose a new password</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Setting a new password for{' '}
              <span className="font-medium text-foreground">{reset.email}</span>.
            </p>
            <ResetPasswordForm token={token} />
          </>
        )}
      </div>
    </div>
  );
}
