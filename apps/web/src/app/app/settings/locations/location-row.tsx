'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Star, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteLocation,
  setDefaultLocation,
  updateLocation,
} from '@/lib/actions/locations';
import { inputCls } from '@/components/ui/field';

type Location = {
  id: string;
  name: string;
  address_line_1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  phone: string | null;
  is_default: boolean;
};

export function LocationRow({
  location,
  canEdit,
}: {
  location: Location;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(fd: FormData) {
    startTransition(async () => {
      const res = await updateLocation(location.id, fd);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Saved');
        setEditing(false);
        router.refresh();
      }
    });
  }

  function handleSetDefault() {
    startTransition(async () => {
      const res = await setDefaultLocation(location.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success(`${location.name} is now default`);
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (location.is_default) {
      toast.error('Set another location as default first.');
      return;
    }
    if (!confirm(`Delete "${location.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteLocation(location.id);
      if (res?.error) toast.error(res.error);
      else {
        toast.success('Deleted');
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <li className="p-4">
        <form action={handleSave} className="space-y-2">
          <input
            name="name"
            defaultValue={location.name}
            required
            className={`${inputCls} h-9`}
            placeholder="Name"
          />
          <input
            name="address_line_1"
            defaultValue={location.address_line_1 ?? ''}
            className={`${inputCls} h-9`}
            placeholder="Address"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              name="city"
              defaultValue={location.city ?? ''}
              className={`${inputCls} h-9`}
              placeholder="City"
            />
            <input
              name="region"
              defaultValue={location.region ?? ''}
              className={`${inputCls} h-9`}
              placeholder="State"
            />
            <input
              name="postal_code"
              defaultValue={location.postal_code ?? ''}
              className={`${inputCls} h-9`}
              placeholder="Zip"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" /> Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between px-6 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{location.name}</span>
          {location.is_default && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              <Star className="h-2.5 w-2.5" /> default
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {[location.address_line_1, location.city, location.region, location.postal_code]
            .filter(Boolean)
            .join(', ') || 'No address'}
          {location.phone ? ` · ${location.phone}` : ''}
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-1">
          {!location.is_default && (
            <button
              onClick={handleSetDefault}
              disabled={isPending}
              title="Set as default"
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Star className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            title="Edit"
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            title="Delete"
            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}
