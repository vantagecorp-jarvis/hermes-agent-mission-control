import { NextResponse } from 'next/server';

// Removed insecure legacy password-in-cookie login. Use NextAuth CSRF flow.
export async function POST() {
  return NextResponse.json({ error: 'Use the owner sign-in page' }, { status: 410 });
}
