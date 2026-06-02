'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { hasRole } from '@cateros/lib';
import { createClient } from '@/lib/supabase/server';
import { requireCurrent } from '@/lib/auth/current';

/** Gate writes to ops+ (ops, sales, manager, owner). */
async function requireOps() {
  const ctx = await requireCurrent();
  if (!hasRole(ctx.role, 'ops')) {
    return { ctx: null, error: 'You do not have permission to manage menus.' };
  }
  return { ctx, error: null as string | null };
}

const menuSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
});

export async function createMenu(formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
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
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
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
        .insert({ menu_id: menuId, name: 'General', org_id: ctx.org.id })
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
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const supabase = await createClient();
  const { error } = await supabase.from('menu_items').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}

// ─── Menu categories ────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function createCategory(menuId: string, formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  // append at the end
  const { data: last } = await supabase
    .from('menu_categories')
    .select('position')
    .eq('menu_id', menuId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from('menu_categories').insert({
    menu_id: menuId,
    name: parsed.data.name,
    org_id: ctx.org.id,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}

export async function renameCategory(id: string, menuId: string, formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_categories')
    .update({ name: parsed.data.name })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}

export async function deleteCategory(id: string, menuId: string) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const supabase = await createClient();
  // menu_items.category_id is ON DELETE SET NULL — block delete if it still has items
  const { count } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id);
  if ((count ?? 0) > 0) {
    return { error: 'Move or delete this category’s items first.' };
  }
  const { error } = await supabase.from('menu_categories').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}

// ─── Modifier groups & modifiers (org-level) ─────────────────────────────────

const modifierGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    is_required: z.coerce.boolean().default(false),
    min_selections: z.coerce.number().int().min(0).default(0),
    max_selections: z.coerce.number().int().min(1).default(1),
  })
  .refine((v) => v.max_selections >= v.min_selections, {
    message: 'Max selections must be greater than or equal to min selections.',
    path: ['max_selections'],
  });

export async function createModifierGroup(formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const raw = Object.fromEntries(formData);
  raw.is_required = formData.get('is_required') ? 'true' : 'false';
  const parsed = modifierGroupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('modifier_groups')
    .insert({ ...parsed.data, org_id: ctx.org.id });
  if (error) return { error: error.message };
  revalidatePath('/app/menus/modifiers');
  return { ok: true };
}

export async function updateModifierGroup(id: string, formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const raw = Object.fromEntries(formData);
  raw.is_required = formData.get('is_required') ? 'true' : 'false';
  const parsed = modifierGroupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase.from('modifier_groups').update(parsed.data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/menus/modifiers');
  return { ok: true };
}

export async function deleteModifierGroup(id: string) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const supabase = await createClient();
  // modifiers and menu_item_modifier_groups cascade on delete.
  const { error } = await supabase.from('modifier_groups').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/menus/modifiers');
  return { ok: true };
}

const modifierSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price_delta_cents: z.coerce.number().int(),
});

export async function createModifier(groupId: string, formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const raw = Object.fromEntries(formData);
  raw.price_delta_cents = String(Math.round(parseFloat(String(raw.price_delta ?? '0')) * 100) || 0);
  const parsed = modifierSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from('modifiers')
    .select('position')
    .eq('group_id', groupId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from('modifiers').insert({
    name: parsed.data.name,
    price_delta_cents: parsed.data.price_delta_cents,
    group_id: groupId,
    org_id: ctx.org.id,
    position: (last?.position ?? -1) + 1,
  });
  if (error) return { error: error.message };
  revalidatePath('/app/menus/modifiers');
  return { ok: true };
}

export async function updateModifier(id: string, formData: FormData) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const raw = Object.fromEntries(formData);
  raw.price_delta_cents = String(Math.round(parseFloat(String(raw.price_delta ?? '0')) * 100) || 0);
  const parsed = modifierSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const supabase = await createClient();
  const { error } = await supabase
    .from('modifiers')
    .update({ name: parsed.data.name, price_delta_cents: parsed.data.price_delta_cents })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/menus/modifiers');
  return { ok: true };
}

export async function deleteModifier(id: string) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const supabase = await createClient();
  const { error } = await supabase.from('modifiers').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/app/menus/modifiers');
  return { ok: true };
}

// ─── Attach / detach modifier groups to a menu item ──────────────────────────

export async function attachModifierGroup(
  menuItemId: string,
  modifierGroupId: string,
  menuId: string,
) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from('menu_item_modifier_groups')
    .select('position')
    .eq('menu_item_id', menuItemId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from('menu_item_modifier_groups')
    .upsert(
      {
        menu_item_id: menuItemId,
        modifier_group_id: modifierGroupId,
        position: (last?.position ?? -1) + 1,
      },
      { onConflict: 'menu_item_id,modifier_group_id', ignoreDuplicates: true },
    );
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}

export async function detachModifierGroup(
  menuItemId: string,
  modifierGroupId: string,
  menuId: string,
) {
  const { ctx, error: roleError } = await requireOps();
  if (!ctx) return { error: roleError };
  const supabase = await createClient();
  const { error } = await supabase
    .from('menu_item_modifier_groups')
    .delete()
    .eq('menu_item_id', menuItemId)
    .eq('modifier_group_id', modifierGroupId);
  if (error) return { error: error.message };
  revalidatePath(`/app/menus/${menuId}`);
  return { ok: true };
}
