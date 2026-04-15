import { Mail, Send, FileCode, Users2 } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';

const modules = [
  {
    icon: Send,
    title: 'Campaigns',
    description:
      'One-off broadcasts to segments of your contact list — promos, seasonal menus, holiday specials.',
  },
  {
    icon: Mail,
    title: 'Sequences',
    description:
      'Triggered drip flows: abandoned-quote follow-up, post-event thank-you, annual rebook reminder.',
  },
  {
    icon: Users2,
    title: 'Segments',
    description:
      'Filter contacts by lifecycle, lead source, custom fields, or event history; reuse segments across campaigns.',
  },
  {
    icon: FileCode,
    title: 'Web forms',
    description:
      'Embeddable script-tag forms with UTM capture that feed directly into your CRM and pipeline.',
  },
];

export default async function MarketingPage() {
  await requireCurrent();
  return (
    <div className="container max-w-4xl py-8">
      <PageHeader title="Marketing" description="Automation to grow bookings and re-engage past clients." />
      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map(({ icon: Icon, title, description }) => (
          <div key={title} className="rounded-lg border bg-card p-5">
            <Icon className="mb-3 h-5 w-5 text-primary" />
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <div className="mt-3 text-xs font-medium text-muted-foreground">Shipping in Phase 6</div>
          </div>
        ))}
      </div>
    </div>
  );
}
