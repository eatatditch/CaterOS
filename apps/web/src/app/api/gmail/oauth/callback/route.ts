import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exchangeCodeForToken, fetchUserEmail } from '@/lib/gmail/oauth';
import { requireCurrent } from '@/lib/auth/current';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await requireCurrent();
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateRaw = searchParams.get('state');
  const errorParam = searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(
      new URL(`/app/settings/integrations?gmail=${encodeURIComponent(errorParam)}`, request.url),
    );
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(
      new URL('/app/settings/integrations?gmail=missing_code', request.url),
    );
  }

  // Verify state matches the current user/org (CSRF + tenant sanity check)
  let state: { orgId?: string; userId?: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8'));
  } catch {
    return NextResponse.redirect(
      new URL('/app/settings/integrations?gmail=bad_state', request.url),
    );
  }
  if (state.orgId !== ctx.org.id || state.userId !== ctx.user.id) {
    return NextResponse.redirect(
      new URL('/app/settings/integrations?gmail=state_mismatch', request.url),
    );
  }

  try {
    const token = await exchangeCodeForToken(code);
    const email = await fetchUserEmail(token.access_token);
    const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

    const admin = createAdminClient();
    await admin.from('gmail_connections').upsert(
      {
        org_id: ctx.org.id,
        email,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        token_expires_at: expiresAt,
        scopes: token.scope.split(' '),
        connected_by: ctx.user.id,
      },
      { onConflict: 'org_id,email' },
    );

    return NextResponse.redirect(
      new URL(`/app/settings/integrations?gmail=connected`, request.url),
    );
  } catch (err) {
    console.error('[gmail oauth callback]', err);
    return NextResponse.redirect(
      new URL(
        `/app/settings/integrations?gmail=error&message=${encodeURIComponent(err instanceof Error ? err.message : 'unknown')}`,
        request.url,
      ),
    );
  }
}
