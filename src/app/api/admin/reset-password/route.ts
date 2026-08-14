import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ONE-SHOT endpoint to reset admin password in production.
// Disable/remove after use. Guarded by a known token.
const RESET_TOKEN = 'lpa-2026-admin-reset-9f8a3c';

export async function POST(request: Request) {
  const token = request.headers.get('x-reset-token') || new URL(request.url).searchParams.get('token');
  if (token !== RESET_TOKEN) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const newPassword = body.password || 'Admin@2026!';

  const hashed = await bcrypt.hash(newPassword, 10);

  await db.update(users)
    .set({ password: hashed })
    .where(eq(users.email, 'admin@caixaescolar.com.br'));

  return NextResponse.json({ ok: true, email: 'admin@caixaescolar.com.br', password_set: newPassword });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST with x-reset-token header' });
}