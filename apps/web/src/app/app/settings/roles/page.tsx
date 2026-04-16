import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  resolveRolePermissions,
  type MemberRole,
  type Permission,
} from '@cateros/lib/auth';
import { RolesMatrixForm } from './roles-matrix-form';

const EDITABLE_ROLES: MemberRole[] = ['manager', 'sales', 'ops', 'driver', 'read_only'];

export default async function RolesSettingsPage() {
  const ctx = await requireCurrent();

  const effective: Record<MemberRole, Record<Permission, boolean>> = {} as Record<
    MemberRole,
    Record<Permission, boolean>
  >;
  for (const role of EDITABLE_ROLES) {
    const set = resolveRolePermissions(role, ctx.rolePermissionOverrides);
    const map = {} as Record<Permission, boolean>;
    for (const perm of ALL_PERMISSIONS) map[perm] = set.has(perm);
    effective[role] = map;
  }

  const defaults: Record<MemberRole, Record<Permission, boolean>> = {} as Record<
    MemberRole,
    Record<Permission, boolean>
  >;
  for (const role of EDITABLE_ROLES) {
    const map = {} as Record<Permission, boolean>;
    for (const perm of ALL_PERMISSIONS) {
      map[perm] = DEFAULT_ROLE_PERMISSIONS[role].includes(perm);
    }
    defaults[role] = map;
  }

  const canEdit = ctx.role === 'owner';

  return (
    <div className="container max-w-6xl py-8">
      <Link
        href="/app/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to settings
      </Link>
      <PageHeader
        title="Roles & permissions"
        description="Decide what each role can and can't do in this workspace. Owner always has full access."
      />

      <div className="mb-4 flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <span>
          Checkboxes control in-app gates. Database-level row security still enforces basic
          tenancy even if a permission is mistakenly granted.
        </span>
      </div>

      <RolesMatrixForm
        roles={EDITABLE_ROLES}
        roleLabels={ROLE_LABELS}
        permissions={ALL_PERMISSIONS}
        permissionLabels={PERMISSION_LABELS}
        effective={effective}
        defaults={defaults}
        canEdit={canEdit}
      />
    </div>
  );
}
