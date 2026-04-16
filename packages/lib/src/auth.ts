export type MemberRole = 'owner' | 'manager' | 'sales' | 'ops' | 'driver' | 'read_only';

export const ROLE_RANK: Record<MemberRole, number> = {
  owner: 100,
  manager: 80,
  sales: 60,
  ops: 50,
  driver: 30,
  read_only: 10,
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  sales: 'Sales',
  ops: 'Ops',
  driver: 'Driver',
  read_only: 'Read-only',
};

export function hasRole(actual: MemberRole, required: MemberRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export type Permission =
  | 'contacts.manage'
  | 'deals.manage'
  | 'menus.manage'
  | 'quotes.manage'
  | 'quotes.send'
  | 'events.manage'
  | 'dispatch.manage'
  | 'invoices.manage'
  | 'invoices.charge'
  | 'marketing.manage'
  | 'integrations.manage'
  | 'team.manage'
  | 'locations.manage'
  | 'org.manage'
  | 'reports.read';

export const ALL_PERMISSIONS: Permission[] = [
  'contacts.manage',
  'deals.manage',
  'menus.manage',
  'quotes.manage',
  'quotes.send',
  'events.manage',
  'dispatch.manage',
  'invoices.manage',
  'invoices.charge',
  'marketing.manage',
  'integrations.manage',
  'team.manage',
  'locations.manage',
  'org.manage',
  'reports.read',
];

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  'contacts.manage': {
    label: 'Contacts',
    description: 'Create, edit, and delete contacts and companies.',
  },
  'deals.manage': {
    label: 'Deals & Pipeline',
    description: 'Create deals and move them between pipeline stages.',
  },
  'menus.manage': {
    label: 'Menus',
    description: 'Manage menu items, modifiers, and packages.',
  },
  'quotes.manage': {
    label: 'Quotes',
    description: 'Build, edit, and delete quotes.',
  },
  'quotes.send': {
    label: 'Send quotes',
    description: 'Email quotes to customers via Gmail.',
  },
  'events.manage': {
    label: 'Events / BEOs',
    description: 'Create and manage events and banquet event orders.',
  },
  'dispatch.manage': {
    label: 'Dispatch',
    description: 'Assign drivers, build routes, and manage deliveries.',
  },
  'invoices.manage': {
    label: 'Invoices',
    description: 'Create, edit, and delete invoices.',
  },
  'invoices.charge': {
    label: 'Charge cards',
    description: 'Take Stripe payments and issue refunds.',
  },
  'marketing.manage': {
    label: 'Marketing',
    description: 'Manage campaigns, segments, and sequences.',
  },
  'integrations.manage': {
    label: 'Integrations',
    description: 'Connect Gmail, Stripe, and other integrations.',
  },
  'team.manage': {
    label: 'Team',
    description: 'Invite members and change their roles.',
  },
  'locations.manage': {
    label: 'Locations',
    description: 'Add and edit operating locations.',
  },
  'org.manage': {
    label: 'Org settings',
    description: 'Edit organization branding, currency, and timezone.',
  },
  'reports.read': {
    label: 'Reports',
    description: 'View reports and analytics dashboards.',
  },
};

// Default permission set per role — used when an org has no overrides in settings.
export const DEFAULT_ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [...ALL_PERMISSIONS],
  manager: [...ALL_PERMISSIONS],
  sales: [
    'contacts.manage',
    'deals.manage',
    'quotes.manage',
    'quotes.send',
    'events.manage',
    'invoices.manage',
    'marketing.manage',
    'reports.read',
  ],
  ops: [
    'contacts.manage',
    'menus.manage',
    'events.manage',
    'dispatch.manage',
    'reports.read',
  ],
  driver: ['dispatch.manage'],
  read_only: ['reports.read'],
};

// Roles that cannot have their permissions reduced — prevents lockout.
export const LOCKED_ROLES: MemberRole[] = ['owner'];

export type RolePermissionOverrides = Partial<Record<MemberRole, Partial<Record<Permission, boolean>>>>;

export function resolveRolePermissions(
  role: MemberRole,
  overrides?: RolePermissionOverrides | null,
): Set<Permission> {
  if (LOCKED_ROLES.includes(role)) {
    return new Set(ALL_PERMISSIONS);
  }
  const defaults = new Set<Permission>(DEFAULT_ROLE_PERMISSIONS[role]);
  const roleOverrides = overrides?.[role];
  if (!roleOverrides) return defaults;
  for (const [perm, allowed] of Object.entries(roleOverrides) as [Permission, boolean][]) {
    if (allowed) defaults.add(perm);
    else defaults.delete(perm);
  }
  return defaults;
}

export function can(
  role: MemberRole,
  perm: Permission,
  overrides?: RolePermissionOverrides | null,
): boolean {
  return resolveRolePermissions(role, overrides).has(perm);
}

// Backwards-compatible alias — some code paths may still import the old map name.
export const ROLE_PERMISSIONS = DEFAULT_ROLE_PERMISSIONS;
