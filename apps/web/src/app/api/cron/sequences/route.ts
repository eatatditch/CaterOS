import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { processSequenceEnrollments } from '@/lib/actions/marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Fail-closed constant-time check of the Vercel cron secret.
// Rejects when CRON_SECRET is unset or the Authorization header doesn't match.
function authorizeCron(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await processSequenceEnrollments();
    return NextResponse.json({ ran_at: new Date().toISOString(), ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    console.error('[cron/sequences]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
