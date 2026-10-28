import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { controlOriginAllowed, freshPasswordGate } from '@/lib/bridge-security';

const verifyFresh = freshPasswordGate();
export async function GET() {
  if ((await getServerSession(authOptions))?.user?.id !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await prisma.bridgeControl.findUnique({ where: { id: 'owner' } });
  const online = !!row && Date.now() - row.heartbeatAt.getTime() < 15_000;
  return NextResponse.json({ online, enabled: online && row?.enabled === true, bootId: online ? row?.bootId : null, supported: ['bridge.agent','soul.read','soul.write','soul.rollback'], blocked: 'No automatic bypass of dangerous-command approvals; no direct wiki editor or cron mutation API' }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  if ((await getServerSession(authOptions))?.user?.id !== 'owner') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!controlOriginAllowed(req.headers, process.env.NEXTAUTH_URL)) return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.enabled !== 'boolean' || typeof b.bootId !== 'string') return NextResponse.json({ error: 'enabled and current bootId required' }, { status: 400 });
  if (b.enabled && !await verifyFresh(b.password, process.env.OWNER_PASSWORD_HASH)) return NextResponse.json({ error: 'Password rejected or attempts throttled' }, { status: 403 });
  const updated = await prisma.bridgeControl.updateMany({ where: { id: 'owner', bootId: b.bootId, heartbeatAt: { gt: new Date(Date.now() - 15_000) } }, data: { enabled: b.enabled } });
  if (updated.count !== 1) return NextResponse.json({ error: 'Bridge offline or restarted; refresh state' }, { status: 409 });
  return GET(); // Read back the exact state, not the submitted intent.
}
