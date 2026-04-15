import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Calendar,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Mail,
  Settings,
  Truck,
  Users,
  Utensils,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/sign-out-button';

const nav = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/app/contacts', label: 'Contacts', icon: Users },
  { href: '/app/pipeline', label: 'Pipeline', icon: ClipboardList },
  { href: '/app/menus', label: 'Menus', icon: Utensils },
  { href: '/app/quotes', label: 'Quotes', icon: ClipboardList },
  { href: '/app/events', label: 'Events', icon: Calendar },
  { href: '/app/dispatch', label: 'Dispatch', icon: Truck },
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/marketing', label: 'Marketing', icon: Mail },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <ChefHat className="h-5 w-5 text-primary" />
          <span className="font-bold">CaterOS</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-4 text-xs">
          <div className="mb-2 truncate text-muted-foreground">{user.email}</div>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
