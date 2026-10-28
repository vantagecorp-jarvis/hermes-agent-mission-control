import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { credentialVersion } from './lib/auth-version';

const publicAuthPaths = new Set([
  '/api/auth/csrf', '/api/auth/providers', '/api/auth/session',
  '/api/auth/signin', '/api/auth/signin/credentials',
  '/api/auth/callback/credentials', '/api/auth/signout', '/api/auth/error',
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // No development bypass, public garden API, legacy password cookie, or
  // shared-secret override. Machine callers need a separately reviewed design.
  if (pathname === '/login' || pathname === '/favicon.ico' ||
      pathname.startsWith('/_next/') || publicAuthPaths.has(pathname)) {
    return NextResponse.next();
  }
  const token = process.env.NEXTAUTH_SECRET
    ? await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }) : null;
  const version = await credentialVersion();
  if (!token || token.sub !== 'owner' || !version || token.credentialVersion !== version) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // NextAuth supplies its own CSRF protection. Protect cookie-authenticated
  // application mutations too; compare against configured canonical proxy URL.
  if (pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin');
    const expected = new URL(process.env.NEXTAUTH_URL || request.url).origin;
    if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && origin !== expected)) {
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
