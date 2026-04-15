import Link from 'next/link';
import {
  Calendar,
  ChefHat,
  ClipboardList,
  CreditCard,
  Mail,
  MapPin,
  Truck,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: Users,
    title: 'CRM Pipeline',
    body: 'Contacts, companies, deals, and a kanban pipeline from lead to repeat client.',
  },
  {
    icon: ChefHat,
    title: 'Menu & Catalog',
    body: 'Versioned menus, modifiers, packages, allergens, and per-item food cost.',
  },
  {
    icon: ClipboardList,
    title: 'Quoting & Proposals',
    body: 'Drag-and-drop quote builder, branded PDFs, eSign, and one-click deposits.',
  },
  {
    icon: Calendar,
    title: 'Events & BEOs',
    body: 'Event calendar, BEO generation, capacity checks, and conflict detection.',
  },
  {
    icon: Truck,
    title: 'Dispatch & Routing',
    body: 'Optimized routes, driver PWA, signature/photo capture, and live ETAs.',
  },
  {
    icon: CreditCard,
    title: 'Billing',
    body: 'Stripe invoices, deposit schedules, ACH, and accounting sync.',
  },
  {
    icon: Mail,
    title: 'Marketing',
    body: 'Drip sequences, segments, web forms, and post-event review requests.',
  },
  {
    icon: MapPin,
    title: 'Multi-location',
    body: 'Tenant-isolated data, RBAC, and per-location menus, taxes, and timezones.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">CaterOS</span>
          </div>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="container py-24 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-primary">
          Catering CRM + Operations
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
          Run your catering business on a single platform.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          CaterOS unifies your CRM, menus, quoting, events, dispatch, and billing — so your team
          stops juggling spreadsheets and starts booking more revenue.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/signup"
            className="rounded-md bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90"
          >
            Start free trial
          </Link>
          <Link
            href="/demo"
            className="rounded-md border px-6 py-3 font-medium hover:bg-accent"
          >
            Book a demo
          </Link>
        </div>
      </section>

      <section className="container pb-24">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-lg border bg-card p-6">
              <Icon className="mb-4 h-8 w-8 text-primary" />
              <h3 className="mb-2 font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex h-16 items-center justify-between text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} CaterOS</span>
          <span>v0.1.0 · Phase 0</span>
        </div>
      </footer>
    </main>
  );
}
