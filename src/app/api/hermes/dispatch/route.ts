import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { operationPolicy } from '@/lib/bridge-security';

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const policy = operationPolicy(b.kind);
  if (!policy.supported) return NextResponse.json({ error: 'Unsupported: all agent execution/mutations require approval and are blocked in this read-only release', approvalRequired: true }, { status: 403 });
  // Insert and OFF checks are serialized with bridge claims/control changes.
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH gate AS MATERIALIZED (SELECT id FROM "BridgeControl" WHERE id='owner' AND enabled=true AND "heartbeatAt">now()-interval '15 seconds' FOR UPDATE)
    INSERT INTO "AgentRequest" (id, origin, kind, title, "sideEffecting", status, "createdAt", "updatedAt")
    SELECT ${crypto.randomUUID()}, 'web', 'hermes.version', 'Read Hermes version', false, 'queued', now(), now() FROM gate RETURNING id`;
  if (!rows.length) return NextResponse.json({ error: 'Bridge OFF or offline; no request accepted' }, { status: 409 });
  const row = await prisma.agentRequest.findUnique({ where: { id: rows[0].id } });
  return NextResponse.json({ request: row });
}
