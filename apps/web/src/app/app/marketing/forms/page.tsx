import { requireCurrent } from '@/lib/auth/current';
import { PageHeader } from '@/components/ui/page-header';
import { EmbedSnippet } from './embed-snippet';

export default async function FormsPage() {
  const ctx = await requireCurrent();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const endpoint = `${appUrl}/api/public/leads/${ctx.org.slug}`;

  return (
    <div className="container max-w-4xl py-8">
      <PageHeader
        title="Web forms"
        description="Drop a form on any website. Submissions create a contact and a deal in your Lead stage, auto-assigned to a catering manager."
      />

      <div className="mb-6 rounded-lg border bg-card p-6">
        <h2 className="mb-2 font-semibold">Your endpoint</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          This is a public POST endpoint. Any site can submit to it.
        </p>
        <code className="block overflow-x-auto rounded bg-muted px-3 py-2 text-xs">
          POST {endpoint}
        </code>
      </div>

      <EmbedSnippet endpoint={endpoint} orgName={ctx.org.name} />

      <div className="mt-6 rounded-lg border bg-card p-6">
        <h2 className="mb-2 font-semibold">JSON fields</h2>
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
              ['event_date', 'ISO 8601', 'no'],
              ['headcount', 'integer', 'no'],
              ['message', 'string', 'no'],
              ['source', 'string', 'no (defaults to web_form)'],
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
