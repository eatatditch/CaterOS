import {
  Calendar,
  ChefHat,
  ClipboardList,
  CreditCard,
  Kanban,
  LayoutDashboard,
  Mail,
  Receipt,
  Settings,
  Truck,
  Users,
  Utensils,
} from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { NavLink } from '@/components/nav-link';
import { SignOutButton } from '@/components/sign-out-button';

// All /app routes are per-user. Never prerender them at build time.
export const dynamic = 'force-dynamic';

const nav = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/contacts', label: 'Contacts', icon: Users },
  { href: '/app/pipeline', label: 'Pipeline', icon: Kanban },
  { href: '/app/menus', label: 'Menus', icon: Utensils },
  { href: '/app/quotes', label: 'Quotes', icon: ClipboardList },
  { href: '/app/events', label: 'Events', icon: Calendar },
  { href: '/app/dispatch', label: 'Dispatch', icon: Truck },
  { href: '/app/invoices', label: 'Invoices', icon: Receipt },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/marketing', label: 'Marketing', icon: Mail },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCurrent();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <ChefHat className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-bold leading-tight">CaterOS</div>
            <div className="truncate text-xs text-muted-foreground">{ctx.org.name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.map(({ href, label, icon: Icon }) => (
            <NavLink
              key={href}
              href={href}
              label={label}
              icon={<Icon className="h-4 w-4" />}
            />
          ))}
        </nav>
        <div className="border-t p-4 text-xs">
          <div className="mb-1 truncate font-medium">{ctx.user.email}</div>
          <div className="mb-2 text-muted-foreground capitalize">{ctx.role.replace('_', ' ')}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
