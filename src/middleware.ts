import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: ['/((?!api/auth|api/admin|api/cron|_next/static|_next/image|favicon.ico|login).*)'],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // public routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // check NextAuth session cookie (JWT strategy uses next-auth.session-token cookie)
  const isSecure = request.nextUrl.protocol === 'https:';
  const sessionTokenName = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

  const token =
    request.cookies.get(sessionTokenName)?.value ??
    request.cookies.get('next-auth.session-token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
