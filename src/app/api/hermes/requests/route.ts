import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownerRequest } from '@/lib/owner-request';
import { profileFor } from '../../../../../hermes-bridge/profiles.mjs';
export async function GET(req: Request) {
  const denied = await ownerRequest(); if (denied) return denied;
  const url = new URL(req.url), agentId = url.searchParams.get('agentId'), sessionKey = url.searchParams.get('sessionKey'), status = url.searchParams.get('status');
  if(agentId) { try { profileFor(agentId); } catch { return NextResponse.json({error:'Unknown registered agent'}, {status:400}); } }
  const n = Number(url.searchParams.get('take') || 100), take = Number.isFinite(n) ? Math.max(1,Math.min(Math.floor(n),200)) : 100;
  const where = { ...(agentId ? {agentId} : {}), ...(sessionKey ? {sessionKey} : {}), ...(status ? {status:{in:status.split(',')}} : {}) };
  const [requests,pending] = await Promise.all([prisma.agentRequest.findMany({where,orderBy:{createdAt:'desc'},take}),prisma.agentRequest.count({where:{status:'awaiting_approval'}})]);
  return NextResponse.json({requests,pending}, {headers:{'Cache-Control':'no-store'}});
}
