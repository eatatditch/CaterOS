import { Calendar, ClipboardList, CreditCard, Users } from 'lucide-react';

const stats = [
  { label: 'Open quotes', value: '0', icon: ClipboardList, hint: 'Awaiting client response' },
  { label: 'Upcoming events', value: '0', icon: Calendar, hint: 'Next 30 days' },
  { label: 'Active contacts', value: '0', icon: Users, hint: 'Across all pipelines' },
  { label: 'Booked revenue', value: '$0', icon: CreditCard, hint: 'This month' },
];

export default function DashboardPage() {
  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome to CaterOS — your catering business at a glance.
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-3xl font-bold">{value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="mb-2 font-semibold">Welcome aboard 👋</h2>
        <p className="text-sm text-muted-foreground">
          You&apos;re running CaterOS Phase 0. Modules will light up as we ship phases 1–7. Next
          up: contacts, deals, and the pipeline.
        </p>
      </div>
    </div>
  );
}
