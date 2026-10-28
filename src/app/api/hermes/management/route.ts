import {NextResponse} from 'next/server';
import {ownerRequest} from '@/lib/owner-request';
import {prisma} from '@/lib/prisma';
import {registeredProfiles} from '../../../../../hermes-bridge/profiles.mjs';
import {validateSoulInput} from '../../../../../hermes-bridge/soul-policy.mjs';
export async function GET(){const denied=await ownerRequest();if(denied)return denied;return NextResponse.json({profiles:registeredProfiles.map(({id,name,home})=>({id,name,profile:home,source:'SOUL.md'})),scope:'Only actual SOUL read/edit/rollback; registration and configuration are read-only'},{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:Request){
 const denied=await ownerRequest(req);if(denied)return denied;
 const raw=await req.text();if(raw.length>280000)return NextResponse.json({error:'Payload too large'},{status:413});
 let b,input;try{b=JSON.parse(raw);input=validateSoulInput(b.input);}catch{return NextResponse.json({error:'Invalid allowlisted SOUL request'},{status:400});}
 const write=input.op!=='soul.read';if(typeof b.bootId!=='string'||(write&&b.authorize!==true))return NextResponse.json({error:'Current boot and explicit owner submission required'},{status:400});
 const id=crypto.randomUUID(),prompt=JSON.stringify(input),status=write?'awaiting_approval':'queued';
 const rows=await prisma.$queryRaw<Array<{id:string}>>`
 WITH gate AS MATERIALIZED (SELECT id FROM "BridgeControl" WHERE id='owner' AND enabled=true AND "bootId"=${b.bootId} AND "heartbeatAt">now()-interval '15 seconds' FOR UPDATE)
 INSERT INTO "AgentRequest" (id,origin,kind,title,prompt,"sideEffecting",status,"agentId","authorizedBy","authorizedAt","bootId","createdAt","updatedAt")
 SELECT ${id},'web',${input.op},${`${input.op} · ${input.agentId}`},${prompt},${write},${status},${input.agentId},'owner',now(),${b.bootId},now(),now() FROM gate RETURNING id`;
 if(!rows.length)return NextResponse.json({error:'Bridge OFF, offline or restarted; nothing accepted'},{status:409});
 return NextResponse.json({request:await prisma.agentRequest.findUnique({where:{id}})},{status:202,headers:{'Cache-Control':'no-store'}});
}
