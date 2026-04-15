import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const schema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).optional().default(''),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional().default(''),
  company: z.string().trim().max(160).optional().default(''),
  event_date: z.string().optional().default(''),
  headcount: z.coerce.number().int().min(0).optional().default(0),
  message: z.string().trim().max(4000).optional().default(''),
  source: z.string().trim().max(80).optional().default('web_form'),
  // honeypot
  website: z.string().optional().default(''),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Parse body (JSON or form-encoded)
  let raw: Record<string, unknown> = {};
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      raw = await request.json();
    } else {
      const fd = await request.formData();
      fd.forEach((v, k) => {
        raw[k] = typeof v === 'string' ? v : '';
      });
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: CORS_HEADERS });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_fields', issues: parsed.error.issues.map((i) => i.message) },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  // Honeypot — if filled, silently accept but don't create anything
  if (parsed.data.website.length > 0) {
    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('capture_lead', {
    p_org_slug: slug,
    p_first_name: parsed.data.first_name,
    p_last_name: parsed.data.last_name || null,
    p_email: parsed.data.email,
    p_phone: parsed.data.phone || null,
    p_company: parsed.data.company || null,
    p_event_date: parsed.data.event_date || null,
    p_headcount: parsed.data.headcount,
    p_message: parsed.data.message || null,
    p_source: parsed.data.source,
  });

  if (error) {
    if (error.message === 'org_not_found') {
      return NextResponse.json({ error: 'org_not_found' }, { status: 404, headers: CORS_HEADERS });
    }
    console.error('[capture_lead]', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ ok: true, deal_id: data }, { headers: CORS_HEADERS });
}
