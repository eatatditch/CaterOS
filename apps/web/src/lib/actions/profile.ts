'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const schema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(0).max(40).optional().default(''),
});

export async function completeProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const full_name = `${parsed.data.first_name} ${parsed.data.last_name}`.trim();
  const phone = parsed.data.phone?.trim() || null;

  const { error } = await supabase
    .from('profiles')
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      full_name,
      phone,
    })
    .eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/app', 'layout');
  redirect('/app');
}
