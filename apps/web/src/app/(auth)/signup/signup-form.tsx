'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const prefilledEmail = searchParams.get('email') ?? '';
  const isInvite = !!inviteToken;

  const [orgName, setOrgName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const redirectPath = inviteToken ? `/invite/${inviteToken}` : '/app';
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: isInvite
          ? { full_name: fullName, invite_token: inviteToken }
          : { full_name: fullName, org_name: orgName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath)}`,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Account created — check your email to confirm.');
    router.push('/login');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {!isInvite ? (
        <div>
          <label className="mb-1 block text-sm font-medium">Catering company</label>
          <input
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Catering Co."
            className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      ) : (
        <p className="rounded-md bg-primary/10 p-3 text-sm text-primary">
          You&apos;re accepting an invitation. Create an account to join the team.
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">Your name</label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Work email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          readOnly={isInvite}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Password</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'Creating account…' : isInvite ? 'Accept invitation' : 'Create account'}
      </button>
    </form>
  );
}
