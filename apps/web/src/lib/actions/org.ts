'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  timezone: z.string().trim().min(1).max(80),
  currency: z.string().trim().length(3),
});

export async function updateOrg(formData: FormData) {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners and managers can update org settings.' };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase.from('orgs').update(parsed.data).eq('id', ctx.org.id);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return { ok: true };
}
