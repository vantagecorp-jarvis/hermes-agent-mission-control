import type {PrismaClient} from '@prisma/client';
import {registeredProfiles,validateAgentInput} from '../../hermes-bridge/profiles.mjs';
import {snapshotIntent} from './snapshot-intent';

// DB-only admission is separate from bridge execution: no worker, CLI or profile I/O.
export async function createDashboardSnapshot(db:Pick<PrismaClient,'$transaction'>,body:unknown){
 const input=validateAgentInput(body);
 const intent=snapshotIntent(input.message);
 if(input.mode!=='chat'||!intent)return null;
 const received=new Date();
 return db.$transaction(async tx=>{
  const startedAt=new Date();
  // Repeatable read before insert: the current question cannot count/summarize itself.
  const counts=await tx.agentRequest.groupBy({by:['kind','status'],_count:{_all:true},orderBy:[{kind:'asc'},{status:'asc'}]});
  const recent=await tx.agentRequest.findMany({where:{kind:'bridge.agent'},orderBy:[{createdAt:'desc'},{id:'desc'}],take:10,select:{id:true,title:true,agentId:true,status:true,createdAt:true}});
  const snapshot=await tx.dataStore.findUnique({where:{key:'mc-profiles'}});
  const sources=(snapshot?.data&&typeof snapshot.data==='object'&&!Array.isArray(snapshot.data)?snapshot.data:{}) as Record<string,unknown>;
  const lines=[`DB snapshot (no LLM) · PostgreSQL read at ${startedAt.toISOString()}.`,
   'Sources: AgentRequest; registeredProfiles (operator registration); DataStore mc-profiles (last bridge metadata).',
   'Scope: dashboard records only, not all fleet activity. Counts cover all persisted AgentRequest rows before this query was inserted; recent rows are limited to the latest 10 bridge.agent requests.',
   'bridge.agent contains chat/task requests (historical mode is not separately recorded); SOUL, diagnostics/tests/other kinds and dashboard snapshots are operational records, not completed tasks. No runtime health is inferred.',
   'Bridge OFF still blocks tool-enabled tasks; this authorized database-only read executes no tools.'];
  if(intent==='tasks'||intent==='both'){
   lines.push('\nRecorded status counts by kind (all rows, not the 200-row UI limit):',...counts.map(c=>`${c.kind} · ${c.status}: ${c._count._all}`));
   if(!counts.length)lines.push('No recorded requests.');
   lines.push('\nRecent dashboard agent requests (latest 10, not a full task inventory):',...recent.map(r=>`${r.id} · ${r.agentId??'unassigned'} · ${r.status} · ${r.createdAt.toISOString()} · ${r.title}`));
   if(!recent.length)lines.push('No recorded bridge.agent requests.');
  }
  if(intent==='agents'||intent==='both'){
   lines.push(`\n${registeredProfiles.length} registered agents. Runtime health: unknown. mc-profiles stored update: ${snapshot?.updatedAt.toISOString()??'not recorded'}.`);
   for(const p of registeredProfiles){
    const value=sources[p.id];const s=(value&&typeof value==='object'&&!Array.isArray(value)?value:{}) as Record<string,unknown>;
    lines.push(`${p.name} (${p.id}) · metadata observed: ${typeof s.observedAt==='string'?s.observedAt:'not recorded'} · session store observed: ${typeof s.sessionStorePresent==='boolean'?String(s.sessionStorePresent):'unknown'} · cron entries: ${Array.isArray(s.crons)?s.crons.length:'unknown'} · source note: ${typeof s.error==='string'?s.error:'none recorded'}`);
   }
  }
  const finishedAt=new Date();
  return tx.agentRequest.create({data:{origin:'web',kind:'dashboard.snapshot',title:input.message.slice(0,100),prompt:input.message,sideEffecting:false,status:'done',result:lines.join('\n'),agentId:input.agentId,sessionKey:input.sessionKey,inputMode:input.inputMode,transcript:input.transcript,authorizedBy:'owner',authorizedAt:received,decidedBy:'owner',decidedAt:received,createdAt:received,startedAt,finishedAt}});
 },{isolationLevel:'RepeatableRead'});
}
