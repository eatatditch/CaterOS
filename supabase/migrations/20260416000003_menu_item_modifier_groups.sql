-- ════════════════════════════════════════════════════════════════════════════
-- Join table: which modifier groups apply to which menu items.
-- A modifier group like "Choose 1 Brunch Option" can be attached to multiple
-- menu items; a menu item can have many modifier groups.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.menu_item_modifier_groups (
  menu_item_id uuid not null references menu_items(id) on delete cascade,
  modifier_group_id uuid not null references modifier_groups(id) on delete cascade,
  position int not null default 0,
  primary key (menu_item_id, modifier_group_id)
);

alter table public.menu_item_modifier_groups enable row level security;

create policy "tenant read" on menu_item_modifier_groups for select
  using (menu_item_id in (select id from menu_items where org_id in (select public.user_org_ids())));
create policy "ops write" on menu_item_modifier_groups for all
  using (menu_item_id in (select id from menu_items where org_id in (select public.user_org_ids())))
  with check (menu_item_id in (select id from menu_items where org_id in (select public.user_org_ids())));

notify pgrst, 'reload schema';
