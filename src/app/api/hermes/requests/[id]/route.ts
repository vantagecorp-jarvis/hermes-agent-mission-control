import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ownerRequest } from '@/lib/owner-request';
import { profileFor } from '../../../../../../hermes-bridge/profiles.mjs';
export async function PATCH(req: Request, {params}: {params:Promise<{id:string}>}) {
  const denied = await ownerRequest(req); if (denied) return denied;
  const {id} = await params, b = await req.json().catch(()=>({}));
  if (!['approve','reject'].includes(b.action)) return NextResponse.json({error:'Only approve or reject supported; submit a new request to revise'}, {status:400});
  const existing = await prisma.agentRequest.findUnique({where:{id}});
  if(!existing) return NextResponse.json({error:'Not found'}, {status:404});
  if(b.action === 'approve') {
    try { profileFor(existing.agentId); } catch { return NextResponse.json({error:'Unregistered agent'}, {status:400}); }
    if(!['bridge.agent','soul.write','soul.rollback'].includes(existing.kind) || existing.authorizedBy !== 'owner' || !existing.authorizedAt || (existing.kind==='bridge.agent' && !existing.sessionKey) || !existing.sideEffecting) return NextResponse.json({error:'Invalid execution authorization'}, {status:403});
  }
  const rows = await prisma.$queryRaw<Array<{id:string}>>`
    WITH gate AS MATERIALIZED (SELECT id FROM "BridgeControl" WHERE id='owner' AND enabled=true AND "bootId"=${b.bootId || ''} AND "heartbeatAt">now()-interval '15 seconds' FOR UPDATE)
    UPDATE "AgentRequest" SET status=${b.action === 'approve' ? 'approved' : 'rejected'}, "decidedAt"=now(), "decidedBy"='owner', "bootId"=${b.bootId || ''}, "updatedAt"=now()
    WHERE id=${id} AND status IN ('awaiting_approval','queued') AND EXISTS (SELECT 1 FROM gate) RETURNING id`;
  if(!rows.length) return NextResponse.json({error:'Bridge OFF/offline/restarted or request already decided'}, {status:409});
  return NextResponse.json({request:await prisma.agentRequest.findUnique({where:{id}})});
}

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const denied=await ownerRequest();if(denied)return denied;
 const {id}=await params;const request=await prisma.agentRequest.findUnique({where:{id}});
 return request?NextResponse.json({request},{headers:{'Cache-Control':'no-store'}}):NextResponse.json({error:'Not found'},{status:404});
}
