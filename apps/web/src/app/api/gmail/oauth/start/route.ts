import { NextResponse } from 'next/server';
import { requireCurrent } from '@/lib/auth/current';
import { buildAuthUrl } from '@/lib/gmail/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await requireCurrent();
  if (ctx.role !== 'owner' && ctx.role !== 'manager') {
    return NextResponse.json(
      { error: 'Only owners/managers can connect Gmail.' },
      { status: 403 },
    );
  }
  // Use the user+org ids in the state so callback can verify.
  const state = Buffer.from(
    JSON.stringify({ orgId: ctx.org.id, userId: ctx.user.id, ts: Date.now() }),
  ).toString('base64url');
  try {
    const url = buildAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Gmail OAuth not configured.' },
      { status: 500 },
    );
  }
}
