import {snapshotIntent} from './snapshot-intent';
export type ResponseClock={createdAt:string;status:string;startedAt?:string|null;finishedAt?:string|null};
export function responseProvenance(kind?:string){
 if(kind==='dashboard.snapshot')return {label:'DB snapshot (no LLM)',sources:'PostgreSQL AgentRequest; operator registeredProfiles; DataStore mc-profiles (recorded bridge metadata).'};
 if(kind==='bridge.agent')return {label:'Hermes agent (LLM/tools)',sources:'Hermes CLI / selected profile. Exact provider/model and individual answer sources not recorded; DB storage is not database-only provenance.'};
 if(kind?.startsWith('soul.')||kind==='hermes.version')return {label:'Bridge operation (not a chat answer)',sources:'Recorded bridge operation result; no LLM provenance inferred.'};
 return {label:'Source unknown (legacy record)',sources:'Execution provenance/provider/model not recorded. Storage in PostgreSQL does not identify the answer source.'};
}
function timestamp(value?:string|null){const n=value?Date.parse(value):NaN;return Number.isFinite(n)?n:null;}
function duration(start:number|null,end:number|null){return start!==null&&end!==null&&end>=start?end-start:null;}
export function responseTiming(row:ResponseClock,now:number){
 const created=timestamp(row.createdAt),start=timestamp(row.startedAt),finish=timestamp(row.finishedAt);
 const terminal=['done','failed','rejected'].includes(row.status);
 const validStart=start!==null&&created!==null&&start>=created?start:null;
 return {elapsedMs:duration(created,terminal?finish:now),queueMs:duration(created,validStart),executionMs:duration(validStart,terminal?finish:now)};
}
export function formatDuration(ms:number|null){return ms===null?'not recorded':`${(ms/1000).toFixed(1)}s`;}

export function canSendMessage(s:{bridgeReady:boolean;busy:boolean;authorize:boolean;message:string;sessionKey:string;mode:string}){
 return !s.busy&&s.authorize&&!!s.message.trim()&&!!s.sessionKey&&(s.bridgeReady||(s.mode==='chat'&&snapshotIntent(s.message)!==null));
}
export function handleComposerKeyDown(e:{key:string;shiftKey:boolean;repeat?:boolean;nativeEvent:{isComposing?:boolean;keyCode?:number};preventDefault:()=>void},allowed:boolean,send:()=>void){
 if(e.key!=='Enter'||e.shiftKey||e.nativeEvent.isComposing||e.nativeEvent.keyCode===229)return;
 e.preventDefault();if(allowed&&!e.repeat)send();
}
export function createSubmissionGuard(){
 let busy=false;
 return {acquire(){if(busy)return false;busy=true;return true;},release(){busy=false;}};
}
