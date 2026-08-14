import { NextResponse } from 'next/server';
import { runDailySync } from '@/lib/sync/daily';

export const runtime = 'nodejs';
export const maxDuration = 300;

// ONE-SHOT endpoint to trigger the daily sync manually.
// Accepts either: a static token (safe for manual ops) OR the CRON_SECRET.
const TRIGGER_TOKEN = 'lpa-2026-sync-9f8a3c';

export async function POST(request: Request) {
  const token =
    request.headers.get('x-trigger-token') ??
    new URL(request.url).searchParams.get('token');
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const authorized =
    token === TRIGGER_TOKEN ||
    (cronSecret && auth === `Bearer ${cronSecret}`);

  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailySync();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST with x-trigger-token header OR Authorization Bearer <CRON_SECRET>',
  });
}