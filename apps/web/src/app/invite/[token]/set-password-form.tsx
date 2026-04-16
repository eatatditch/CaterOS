'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setInvitePassword } from '@/lib/actions/invite';
import { Field, inputCls, buttonPrimaryCls } from '@/components/ui/field';

export function SetPasswordForm({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    const fd = new FormData();
    fd.set('token', token);
    fd.set('password', password);
    startTransition(async () => {
      const res = await setInvitePassword(fd);
      if (res?.error) {
        setError(res.error);
        toast.error(res.error);
      }
      // on success the action redirects — nothing to do here
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Choose a password" htmlFor="password">
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirm">
        <input
          id="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputCls}
        />
      </Field>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button type="submit" disabled={isPending} className={`${buttonPrimaryCls} w-full`}>
        {isPending ? 'Saving…' : 'Continue'}
      </button>
    </form>
  );
}
