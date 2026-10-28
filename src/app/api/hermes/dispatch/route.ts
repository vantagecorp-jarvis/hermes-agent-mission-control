import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownerRequest } from '@/lib/owner-request';
import { validateAgentInput } from '../../../../../hermes-bridge/profiles.mjs';

export async function POST(req: Request) {
  const denied = await ownerRequest(req); if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  let input;
  try { input = validateAgentInput(b); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
  if (typeof b.bootId !== 'string') return NextResponse.json({error:'Current bootId required'}, {status:400});
  const status = input.mode === 'task' ? 'awaiting_approval' : 'approved';
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH gate AS MATERIALIZED (SELECT id FROM "BridgeControl" WHERE id='owner' AND enabled=true AND "bootId"=${b.bootId} AND "heartbeatAt">now()-interval '15 seconds' FOR UPDATE)
    INSERT INTO "AgentRequest" (id, origin, kind, title, prompt, "sideEffecting", status, "agentId", "sessionKey", "inputMode", transcript, "authorizedBy", "authorizedAt", "decidedBy", "decidedAt", "bootId", "createdAt", "updatedAt")
    SELECT ${crypto.randomUUID()}, 'web', 'bridge.agent', ${input.message.slice(0,100)}, ${input.message}, true, ${status}, ${input.agentId}, ${input.sessionKey}, ${input.inputMode}, ${input.transcript}, 'owner', now(), ${status === 'approved' ? 'owner' : null}, ${status === 'approved' ? new Date() : null}, ${b.bootId}, now(), now() FROM gate RETURNING id`;
  if (!rows.length) return NextResponse.json({ error: 'Bridge OFF, offline or restarted; no request accepted' }, { status: 409 });
  return NextResponse.json({ request: await prisma.agentRequest.findUnique({ where: { id: rows[0].id } }) }, {status:202});
}
