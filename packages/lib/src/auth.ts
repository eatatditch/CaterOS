export type MemberRole = 'owner' | 'manager' | 'sales' | 'ops' | 'driver' | 'read_only';

export const ROLE_RANK: Record<MemberRole, number> = {
  owner: 100,
  manager: 80,
  sales: 60,
  ops: 50,
  driver: 30,
  read_only: 10,
};

export function hasRole(actual: MemberRole, required: MemberRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export type Permission =
  | 'org:manage'
  | 'members:manage'
  | 'contacts:write'
  | 'deals:write'
  | 'menus:write'
  | 'quotes:write'
  | 'events:write'
  | 'dispatch:write'
  | 'billing:write'
  | 'reports:read';

export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    'org:manage',
    'members:manage',
    'contacts:write',
    'deals:write',
    'menus:write',
    'quotes:write',
    'events:write',
    'dispatch:write',
    'billing:write',
    'reports:read',
  ],
  manager: [
    'members:manage',
    'contacts:write',
    'deals:write',
    'menus:write',
    'quotes:write',
    'events:write',
    'dispatch:write',
    'billing:write',
    'reports:read',
  ],
  sales: ['contacts:write', 'deals:write', 'quotes:write', 'reports:read'],
  ops: ['events:write', 'dispatch:write', 'menus:write', 'reports:read'],
  driver: ['dispatch:write'],
  read_only: ['reports:read'],
};

export function can(role: MemberRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(perm);
}
