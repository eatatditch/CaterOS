import Link from 'next/link';
import { FileCode, Mail, Send, Users2, Zap } from 'lucide-react';
import { requireCurrent } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/page-header';

export default async function MarketingPage() {
  const ctx = await requireCurrent();
  const supabase = await createClient();
  const [{ count: campaignCount }, { count: segmentCount }, { count: sequenceCount }] =
    await Promise.all([
      supabase
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.org.id),
      supabase
        .from('segments')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.org.id),
      supabase
        .from('sequences')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', ctx.org.id),
    ]);

  const tiles = [
    {
      href: '/app/marketing/forms',
      icon: FileCode,
      title: 'Web forms',
      description: 'Embeddable lead-capture form for your website.',
      badge: 'Live',
    },
    {
      href: '/app/marketing/campaigns',
      icon: Send,
      title: 'Campaigns',
      description: 'One-off broadcasts to a segment — promos, seasonal menus, holiday pushes.',
      badge: `${campaignCount ?? 0}`,
    },
    {
      href: '/app/marketing/sequences',
      icon: Zap,
      title: 'Sequences',
      description:
        'Multi-step drips — abandoned-quote nudges, post-event thanks, annual rebook reminders.',
      badge: `${sequenceCount ?? 0}`,
    },
    {
      href: '/app/marketing/segments',
      icon: Users2,
      title: 'Segments',
      description: 'Filtered contact lists by lifecycle, source, tags, or date.',
      badge: `${segmentCount ?? 0}`,
    },
  ];

  return (
    <div className="container max-w-4xl py-8">
      <PageHeader title="Marketing" description="Automation to grow bookings and re-engage past clients." />
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map(({ href, icon: Icon, title, description, badge }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border bg-card p-5 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-5 w-5 text-primary" />
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {badge}
              </span>
            </div>
            <h3 className="mt-3 font-semibold group-hover:text-primary">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
        <strong className="text-foreground">Personalization tokens:</strong> use{' '}
        <code className="rounded bg-muted px-1">{'{{first_name}}'}</code> anywhere in a
        campaign or sequence subject/body and it&apos;ll be swapped with the recipient&apos;s
        first name at send time. <Mail className="inline h-3 w-3" /> All marketing emails go
        out via your connected Gmail account.
      </div>
    </div>
  );
}
