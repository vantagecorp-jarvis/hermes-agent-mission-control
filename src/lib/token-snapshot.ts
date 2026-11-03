import type {TokenSnapshot} from './token-usage';
export const TOKEN_USAGE_KEY='mc-token-usage-v1';
const agents=['default','yana','jenny','michael','michelle'];
const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
const stamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&!Number.isNaN(Date.parse(v));
function shape(v:unknown,fields:Record<string,(x:unknown)=>boolean>):boolean {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const o=v as Record<string,unknown>;
 return Object.keys(o).length===Object.keys(fields).length&&Object.entries(fields).every(([k,check])=>check(o[k]));
}
const nullable=(check:(v:unknown)=>boolean)=>(v:unknown)=>v===null||check(v);
const metricFields=Object.fromEntries(['input','output','cacheRead','cacheWrite','reasoning','total','missingCost','includedCost','actualCount','estimatedCount'].map(k=>[k,numeric]));
export function validTokenSnapshot(v:unknown):v is TokenSnapshot {
 return shape(v,{version:x=>x===1,collectedAt:stamp,timezone:x=>x==='Europe/Warsaw',attribution:x=>x==='session-start',
  sources:x=>Array.isArray(x)&&x.length<=5&&new Set(x.map(s=>s.agentId)).size===x.length&&x.every(s=>shape(s,{
   agentId:id=>agents.includes(id as string),name:n=>['MIA','YANA','JENNY','MICHAEL','MICHELLE'].includes(n as string),status:z=>['ready','empty','unavailable'].includes(z as string),sessions:numeric,activeSessions:numeric,undatedSessions:numeric,firstDay:nullable(date),lastDay:nullable(date),lastActivity:nullable(stamp),error:e=>e===null||e==='Session store unavailable or schema unsupported'})),
  rows:x=>Array.isArray(x)&&x.length<=100000&&x.every(r=>shape(r,{day:date,agentId:id=>agents.includes(id as string),sessions:numeric,auxiliaryRecords:numeric,metrics:m=>shape(m,{...metricFields,actualUsd:nullable(numeric),estimatedUsd:nullable(numeric)}),retrieval:r=>shape(r,{kb:numeric,external:numeric,mixed:numeric,unknown:numeric}),kbCalls:numeric,externalCalls:numeric,incompleteSessions:numeric}))});
}
