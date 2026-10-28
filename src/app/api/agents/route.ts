import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {ownerRequest} from '@/lib/owner-request';
import {registeredProfiles} from '../../../../hermes-bridge/profiles.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 const denied=await ownerRequest();if(denied)return denied;
 const [bridge,snapshot]=await Promise.all([prisma.bridgeControl.findUnique({where:{id:'owner'}}),prisma.dataStore.findUnique({where:{key:'mc-profiles'}})]);
 const available=!!bridge&&bridge.enabled&&Date.now()-bridge.heartbeatAt.getTime()<15000;
 const sources=(snapshot?.data as Record<string,any>)||{};
 const agents=await Promise.all(registeredProfiles.map(async(p)=>{
  const [tasksCompleted,running,last]=await Promise.all([prisma.agentRequest.count({where:{agentId:p.id,status:'done'}}),prisma.agentRequest.findFirst({where:{agentId:p.id,status:'running'},orderBy:{createdAt:'desc'}}),prisma.agentRequest.findFirst({where:{agentId:p.id},orderBy:{updatedAt:'desc'}})]);
  return {id:p.id,name:p.name,status:running?'working':available?'available':'unavailable',tasksCompleted,lastActive:last?.updatedAt,currentTask:running?.title,...sources[p.id]};
 }));
 return NextResponse.json(agents,{headers:{'Cache-Control':'no-store'}});
}
