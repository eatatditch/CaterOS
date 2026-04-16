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
import type { Permission } from '@cateros/lib/auth';
import { requireCurrent } from '@/lib/auth/current';
import { NavLink } from '@/components/nav-link';
import { MobileNav, type MobileNavItem } from '@/components/mobile-nav';
import { SignOutButton } from '@/components/sign-out-button';

export const dynamic = 'force-dynamic';

// Each entry pairs the href/label with a pre-rendered icon JSX element so it
// can cross the RSC → Client Component boundary (functions can't).
type NavEntry = {
  href: string;
  label: string;
  Icon: typeof LayoutDashboard;
  perm?: Permission;
};

const navConfig: NavEntry[] = [
  { href: '/app', label: 'Dashboard', Icon: LayoutDashboard },
  { href: '/app/contacts', label: 'Contacts', Icon: Users, perm: 'contacts.manage' },
  { href: '/app/pipeline', label: 'Pipeline', Icon: Kanban, perm: 'deals.manage' },
  { href: '/app/menus', label: 'Menus', Icon: Utensils, perm: 'menus.manage' },
  { href: '/app/quotes', label: 'Quotes', Icon: ClipboardList, perm: 'quotes.manage' },
  { href: '/app/events', label: 'Events', Icon: Calendar, perm: 'events.manage' },
  { href: '/app/dispatch', label: 'Dispatch', Icon: Truck, perm: 'dispatch.manage' },
  { href: '/app/invoices', label: 'Invoices', Icon: Receipt, perm: 'invoices.manage' },
  { href: '/app/billing', label: 'Billing', Icon: CreditCard, perm: 'invoices.charge' },
  { href: '/app/marketing', label: 'Marketing', Icon: Mail, perm: 'marketing.manage' },
  { href: '/app/settings', label: 'Settings', Icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCurrent();

  const visibleNav = navConfig.filter((n) => !n.perm || ctx.can(n.perm));

  const mobileItems: MobileNavItem[] = visibleNav.map(({ href, label, Icon }) => ({
    href,
    label,
    icon: <Icon className="h-4 w-4" />,
  }));

  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      {/* Mobile top bar + drawer */}
      <MobileNav
        items={mobileItems}
        orgName={ctx.org.name}
        userEmail={ctx.user.email ?? ''}
        role={ctx.role}
        signOut={<SignOutButton />}
      />

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <ChefHat className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-bold leading-tight">CaterOS</div>
            <div className="truncate text-xs text-muted-foreground">{ctx.org.name}</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {visibleNav.map(({ href, label, Icon }) => (
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
          <div className="mb-2 capitalize text-muted-foreground">{ctx.role.replace('_', ' ')}</div>
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
