'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChefHat, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileNavItem = {
  href: string;
  label: string;
  icon: React.ReactNode; // pre-rendered JSX, not a component type
};

export function MobileNav({
  items,
  orgName,
  userEmail,
  role,
  signOut,
}: {
  items: MobileNavItem[];
  orgName: string;
  userEmail: string;
  role: string;
  signOut: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-card px-4 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-ml-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <ChefHat className="h-5 w-5 text-primary" />
          <div className="truncate text-sm font-bold">{orgName}</div>
        </div>
        <div className="w-10" aria-hidden />
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(320px,85vw)] flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-sm font-bold leading-tight">CaterOS</div>
                  <div className="truncate text-xs text-muted-foreground">{orgName}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="-mr-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <ul className="space-y-0.5">
                {items.map(({ href, label, icon }) => {
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        className={cn(
                          'flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors',
                          active
                            ? 'bg-accent font-medium text-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        )}
                      >
                        {icon}
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="border-t p-4 text-xs">
              <div className="mb-1 truncate font-medium">{userEmail}</div>
              <div className="mb-3 capitalize text-muted-foreground">{role.replace('_', ' ')}</div>
              {signOut}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
