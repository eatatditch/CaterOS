import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { getWebFormSettings } from '@/lib/actions/web-form';
import { SquarespaceInstall } from './squarespace-install';
import { EmbedSnippet } from './embed-snippet';

export default async function FormsPage() {
  const ctx = await requireCurrent();
  const explicitUrl = process.env.NEXT_PUBLIC_APP_URL;
  const fallbackUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  const appUrl = explicitUrl ?? fallbackUrl;
  const isPreviewUrl = !explicitUrl && /vercel\.app$/.test(appUrl) && appUrl.split('-').length > 2;
  const savedSettings = await getWebFormSettings();
  const canSave = ctx.role === 'owner' || ctx.role === 'manager';

  return (
    <div className="container max-w-4xl py-8">
      <PageHeader
        title="Web forms"
        description="Drop a lead-capture form on any website. Submissions create a deal in your pipeline auto-assigned to a catering manager."
      />

      {isPreviewUrl ? (
        <div className="mb-6 rounded-lg border border-yellow-400/40 bg-yellow-50 p-4 text-sm text-yellow-900 dark:bg-yellow-500/10 dark:text-yellow-200">
          <p className="font-semibold">Heads up — embed URLs are pointing at a preview deployment.</p>
          <p className="mt-1">
            Set <code className="rounded bg-yellow-100 px-1 text-xs dark:bg-yellow-500/20">NEXT_PUBLIC_APP_URL</code>{' '}
            in Vercel → Settings → Environment Variables to your production URL (e.g.{' '}
            <code className="rounded bg-yellow-100 px-1 text-xs dark:bg-yellow-500/20">https://cater-os.vercel.app</code>)
            and redeploy. Preview URLs are behind Vercel Deployment Protection, so iframes won&apos;t render on external sites.
          </p>
        </div>
      ) : null}

      <SquarespaceInstall
        appUrl={appUrl}
        orgSlug={ctx.org.slug}
        orgName={ctx.org.name}
        initialSettings={savedSettings}
        canSave={canSave}
      />

      <div className="mt-10">
        <h2 className="mb-1 text-lg font-semibold">More options</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Standalone HTML and raw fetch examples for anywhere else.
        </p>
        <EmbedSnippet
          endpoint={`${appUrl}/api/public/leads/${ctx.org.slug}`}
          orgName={ctx.org.name}
        />
      </div>

      <div className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="mb-2 font-semibold">Raw API</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Build your own UI and POST JSON. CORS is enabled.
        </p>
        <code className="block overflow-x-auto rounded bg-muted px-3 py-2 text-xs">
          POST {appUrl}/api/public/leads/{ctx.org.slug}
        </code>

        <h3 className="mb-2 mt-4 text-sm font-semibold">JSON fields</h3>
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Field</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 font-medium">Required</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {[
              ['first_name', 'string', 'yes'],
              ['last_name', 'string', 'no'],
              ['email', 'string (email)', 'yes'],
              ['phone', 'string', 'no'],
              ['company', 'string', 'no'],
              ['event_date', 'ISO date (YYYY-MM-DD)', 'no'],
              ['headcount', 'integer', 'no'],
              ['message', 'string', 'no'],
              ['source', 'string', 'no — defaults to web_form'],
            ].map(([f, t, r]) => (
              <tr key={f}>
                <td className="py-2 pr-4 font-mono text-xs">{f}</td>
                <td className="py-2 pr-4 text-muted-foreground">{t}</td>
                <td className="py-2">{r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
