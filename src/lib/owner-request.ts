import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { controlOriginAllowed } from './bridge-security';
import { NextResponse } from 'next/server';
export async function ownerRequest(req?: Request) {
  if ((await getServerSession(authOptions))?.user?.id !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (req && !controlOriginAllowed(req.headers, process.env.NEXTAUTH_URL)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  return null;
}
