'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

const menuSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
});

export async function createMenu(formData: FormData) {
  const ctx = await requireCurrent();
  const parsed = menuSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('menus')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      org_id: ctx.org.id,
    })
    .select('id')
    .single();
  if (error) return { error: error.message };
  revalidatePath('/app/menus');
  redirect(`/app/menus/${data.id}`);
}

const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  unit: z.string().trim().max(40).default('person'),
  unit_price_cents: z.coerce.number().int().min(0).default(0),
  unit_cost_cents: z.coerce.number().int().min(0).default(0),
  min_quantity: z.coerce.number().int().min(1).default(1),
  category_id: z.string().uuid().optional().or(z.literal('')),
});

export async function createMenuItem(menuId: string, formData: FormData) {
  const ctx = await requireCurrent();
  const raw = Object.fromEntries(formData);
  // convert $ → cents
  raw.unit_price_cents = String(Math.round(parseFloat(String(raw.price ?? '0')) * 100) || 0);
  raw.unit_cost_cents = String(Math.round(parseFloat(String(raw.cost ?? '0')) * 100) || 0);
  const parsed = menuItemSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const payload = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, v === '' ? null : v]),
  );
  // find or create a default category for this menu
  let categoryId = parsed.data.category_id || null;
  if (!categoryId) {
    const { data: cat } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('menu_id', menuId)
      .order('position')
      .limit(1)
      .maybeSingle();
    if (cat) categoryId = cat.id;
    else {
      const { data: newCat } = await supabase
        .from('menu_categories')
        .insert({ menu_id: menuId, name: 'Items', org_id: ctx.org.id })
        .select('id')
        .single();
      categoryId = newCat?.id ?? null;
    }
  }
  const { error } = await supabase
    .from('menu_items')
    .insert({ ...payload, org_id: ctx.org.id, category_id: categoryId });
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}

export async function deleteMenuItem(id: string, menuId: string) {
  await requireCurrent();
  const supabase = await createClient();
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}
