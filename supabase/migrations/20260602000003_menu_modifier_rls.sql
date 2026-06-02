-- ════════════════════════════════════════════════════════════════════════════
-- CaterOS · Tighten menu_item_modifier_groups write policy to ops+ and add
-- supporting indexes for the modifier management UI.
--
-- The original "ops write" policy on menu_item_modifier_groups (migration
-- 20260416000003) only verified org membership via user_org_ids(), so ANY org
-- member could attach/detach modifier groups. The join row has no org_id of its
-- own, so we scope the role check through the parent menu_item's org_id — the
-- same approach the sibling menu tables use with has_org_role(org_id, 'ops').
-- ════════════════════════════════════════════════════════════════════════════

drop policy if exists "ops write" on public.menu_item_modifier_groups;

create policy "ops write" on public.menu_item_modifier_groups for all
  using (
    menu_item_id in (
      select id from public.menu_items where public.has_org_role(org_id, 'ops')
    )
  )
  with check (
    menu_item_id in (
      select id from public.menu_items where public.has_org_role(org_id, 'ops')
    )
  );

-- Supporting indexes for the org-level modifier management surface.
create index if not exists modifier_groups_org_id_idx on public.modifier_groups(org_id);
create index if not exists modifiers_group_id_idx on public.modifiers(group_id);

notify pgrst, 'reload schema';
