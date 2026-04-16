'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import type { MemberRole, Permission } from '@cateros/lib/auth';
import { updateRolePermissions, resetRolePermissions } from '@/lib/actions/roles';
import { buttonOutlineCls, buttonPrimaryCls } from '@/components/ui/field';

type Grid = Record<MemberRole, Record<Permission, boolean>>;

export function RolesMatrixForm({
  roles,
  roleLabels,
  permissions,
  permissionLabels,
  effective,
  defaults,
  canEdit,
}: {
  roles: MemberRole[];
  roleLabels: Record<MemberRole, string>;
  permissions: Permission[];
  permissionLabels: Record<Permission, { label: string; description: string }>;
  effective: Grid;
  defaults: Grid;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [grid, setGrid] = useState<Grid>(effective);
  const [isPending, startTransition] = useTransition();
  const [isResetting, startReset] = useTransition();

  function toggle(role: MemberRole, perm: Permission) {
    if (!canEdit) return;
    setGrid((prev) => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }));
  }

  function resetToDefaults() {
    setGrid(defaults);
  }

  function onSubmit() {
    if (!canEdit) return;
    const fd = new FormData();
    for (const role of roles) {
      for (const perm of permissions) {
        if (grid[role][perm]) fd.append(`${role}.${perm}`, 'on');
      }
    }
    startTransition(async () => {
      const res = await updateRolePermissions(fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Role permissions saved');
        router.refresh();
      }
    });
  }

  function onHardReset() {
    if (!canEdit) return;
    if (!confirm('Reset all roles to CaterOS defaults? Any customisations will be lost.')) return;
    startReset(async () => {
      const res = await resetRolePermissions();
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Reset to defaults');
        setGrid(defaults);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium">
                Permission
              </th>
              {roles.map((role) => (
                <th
                  key={role}
                  className="px-3 py-3 text-center font-medium"
                  style={{ minWidth: 96 }}
                >
                  {roleLabels[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((perm) => (
              <tr key={perm} className="border-t">
                <td className="sticky left-0 z-10 bg-card px-4 py-3">
                  <div className="font-medium">{permissionLabels[perm].label}</div>
                  <div className="text-xs text-muted-foreground">
                    {permissionLabels[perm].description}
                  </div>
                </td>
                {roles.map((role) => {
                  const checked = grid[role][perm];
                  const changed = checked !== defaults[role][perm];
                  return (
                    <td key={role} className="px-3 py-3 text-center">
                      <label className="inline-flex cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEdit}
                          onChange={() => toggle(role, perm)}
                          className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                        />
                        {changed ? (
                          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        ) : null}
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isPending}
            className={buttonPrimaryCls}
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={resetToDefaults} className={buttonOutlineCls}>
            <RotateCcw className="h-4 w-4" /> Preview defaults
          </button>
          <button
            type="button"
            onClick={onHardReset}
            disabled={isResetting}
            className={buttonOutlineCls}
          >
            {isResetting ? 'Resetting…' : 'Reset & save defaults'}
          </button>
          <p className="text-xs text-muted-foreground">
            A dot next to a checkbox means it differs from the CaterOS default.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Only the org owner can change role permissions.
        </p>
      )}
    </div>
  );
}
