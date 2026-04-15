'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';
import {
  DEFAULT_WEB_FORM_SETTINGS,
  WEB_FORM_FIELD_KEYS,
  type WebFormSettings,
} from '@/lib/types/web-form';

const schema = z.object({
  method: z.enum(['iframe', 'script']),
  accent: z.string().regex(/^#[0-9a-f]{3,8}$/i, 'Invalid color'),
  button_text: z.string().min(1).max(80),
  thanks_text: z.string().min(1).max(200),
  enabled_fields: z.array(z.enum(WEB_FORM_FIELD_KEYS)),
  required_fields: z.array(z.enum(WEB_FORM_FIELD_KEYS)),
});

export async function getWebFormSettings(): Promise<WebFormSettings> {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const { data } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();

  const stored = (data?.settings as Record<string, unknown> | null)?.web_form as
    | Partial<WebFormSettings>
    | undefined;

  return { ...DEFAULT_WEB_FORM_SETTINGS, ...(stored ?? {}) };
}

export async function saveWebFormSettings(input: WebFormSettings) {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return { error: 'Only owners and managers can save form settings.' };
  }
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid settings' };
  }

  const supabase = await createClient();
  const { data: org, error: fetchErr } = await supabase
    .from('orgs')
    .select('settings')
    .eq('id', ctx.org.id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };

  const current = (org?.settings as Record<string, unknown> | null) ?? {};
  const { error } = await supabase
    .from('orgs')
    .update({ settings: { ...current, web_form: parsed.data } })
    .eq('id', ctx.org.id);
  if (error) return { error: error.message };

  revalidatePath('/app/marketing/forms');
  return { ok: true };
}
