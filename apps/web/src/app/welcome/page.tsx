import { redirect } from 'next/navigation';
import { ChefHat } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import { WelcomeForm } from './welcome-form';

export const dynamic = 'force-dynamic';

export default async function WelcomePage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, phone, full_name')
    .eq('id', ctx.user.id)
    .maybeSingle();

  // Already completed — don't re-prompt.
  if (profile?.first_name && profile?.last_name) {
    redirect('/app');
  }

  // If full_name was set via legacy signup, try to split it so the fields are pre-filled.
  const parts = (profile?.full_name ?? '').trim().split(/\s+/);
  const presetFirst = profile?.first_name ?? parts[0] ?? '';
  const presetLast = profile?.last_name ?? parts.slice(1).join(' ') ?? '';

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-muted/30 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <ChefHat className="mx-auto mb-3 h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold">Finish setting up your profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We just need a few details before you jump in.
          </p>
        </div>
        <WelcomeForm
          initial={{
            first_name: presetFirst,
            last_name: presetLast,
            phone: profile?.phone ?? '',
          }}
        />
      </div>
    </div>
  );
}
