import { NextResponse, type NextRequest } from 'next/server';
import { processSequenceEnrollments } from '@/lib/actions/marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
