import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { EmbedForm, type FieldKey } from './embed-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALL_FIELDS: FieldKey[] = [
  'last_name',
  'phone',
  'company',
  'event_date',
  'event_time',
  'service_type',
  'location',
  'guest_count',
  'message',
];

export default async function EmbedFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const supabase = createAdminClient();
  const { data: meta } = await supabase.rpc('form_meta', { p_org_slug: slug });
  if (!meta || !meta.org) notFound();

  const fieldsParam = sp.fields;
  const requiredParam = sp.required;

  const fields = fieldsParam
    ? (fieldsParam.split(',').map((s) => s.trim()).filter(Boolean) as FieldKey[])
    : ALL_FIELDS;

  const required = requiredParam
    ? (requiredParam.split(',').map((s) => s.trim()).filter(Boolean) as FieldKey[])
    : [];

  const accent = sp.accent && /^#[0-9a-f]{3,8}$/i.test(sp.accent) ? sp.accent : '#ea580c';
  const buttonText = sp.button || 'Request a quote';
  const thanks = sp.thanks || "Thanks! We'll be in touch shortly.";
  const hideBranding = sp.branding === 'off' || sp.branding === 'false';

  return (
    <EmbedForm
      slug={slug}
      fields={fields}
      required={required}
      accent={accent}
      buttonText={buttonText}
      thanks={thanks}
      locations={meta.locations ?? []}
      hideBranding={hideBranding}
    />
  );
}
