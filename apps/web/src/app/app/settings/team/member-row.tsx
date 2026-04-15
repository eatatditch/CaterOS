'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { changeMemberRole, removeMember } from '@/lib/actions/team';
import { selectCls } from '@/components/ui/field';

const allRoles = ['owner', 'manager', 'sales', 'ops', 'driver', 'read_only'] as const;

export function MemberRow({
  member,
  currentUserId,
  currentRole,
  canManage,
}: {
  member: { userId: string; role: string; fullName: string };
  currentUserId: string;
  currentRole: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isSelf = member.userId === currentUserId;
  const canEdit = canManage && !isSelf;
  const roleOptions = currentRole === 'owner' ? allRoles : allRoles.filter((r) => r !== 'owner');

  function onRoleChange(value: string) {
    if (value === member.role) return;
    const fd = new FormData();
    fd.set('role', value);
    startTransition(async () => {
      const res = await changeMemberRole(member.userId, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Role updated');
        router.refresh();
      }
    });
  }

  function onRemove() {
    if (!confirm(`Remove ${member.fullName} from the org?`)) return;
    startTransition(async () => {
      const res = await removeMember(member.userId);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Removed');
        router.refresh();
      }
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-6 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {member.fullName}
          {isSelf ? <span className="ml-2 text-xs text-muted-foreground">(you)</span> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {canEdit ? (
          <select
            value={member.role}
            onChange={(e) => onRoleChange(e.target.value)}
            disabled={isPending}
            className={`${selectCls} h-8 w-36 text-xs`}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {member.role.replace('_', ' ')}
          </span>
        )}
        {canEdit ? (
          <button
            onClick={onRemove}
            disabled={isPending}
            title="Remove"
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
}
