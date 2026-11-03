import {test} from 'node:test';
import assert from 'node:assert/strict';
import {responseProvenance,responseTiming,formatDuration,handleComposerKeyDown,canSendMessage,createSubmissionGuard} from '../src/lib/response-ux';

test('provenance follows execution kind, not DB storage; old unknown and Hermes never become database-only',()=>{
 assert.match(responseProvenance('dashboard.snapshot').label,/DB snapshot \(no LLM\)/);
 assert.match(responseProvenance('dashboard.snapshot').sources,/AgentRequest.*mc-profiles/);
 assert.match(responseProvenance('bridge.agent').label,/Hermes agent \(LLM\/tools\)/);
 assert.match(responseProvenance('bridge.agent').sources,/provider\/model.*not recorded/i);
 for(const kind of [undefined,'chat','oneshot','unknown'])assert.match(responseProvenance(kind).label,/unknown/i);
 assert.doesNotMatch(responseProvenance('bridge.agent').label,/DB snapshot|mixed/i);
});
test('elapsed, queue and execution durations use actual timestamps only, never updatedAt as a start or fake ETA',()=>{
 const createdAt='2026-01-01T00:00:00Z';const now=Date.parse(createdAt)+20000;
 const running=responseTiming({createdAt,status:'running',startedAt:'2026-01-01T00:00:05Z'},now);
 assert.deepEqual(running,{elapsedMs:20000,queueMs:5000,executionMs:15000});
 const done=responseTiming({createdAt,status:'done',startedAt:'2026-01-01T00:00:05Z',finishedAt:'2026-01-01T00:00:15Z'},now);
 assert.deepEqual(done,{elapsedMs:15000,queueMs:5000,executionMs:10000});
 assert.deepEqual(responseTiming({createdAt,status:'awaiting_approval'},now),{elapsedMs:20000,queueMs:null,executionMs:null});
 assert.deepEqual(responseTiming({createdAt,status:'done',startedAt:null,finishedAt:null},now),{elapsedMs:null,queueMs:null,executionMs:null});
 assert.deepEqual(responseTiming({createdAt:'bad',status:'running',startedAt:'bad'},now),{elapsedMs:null,queueMs:null,executionMs:null});
 assert.equal(responseTiming({createdAt,status:'running',startedAt:'2025-01-01'},now).queueMs,null);
 assert.equal(responseTiming({createdAt:'2026-02-01',status:'running'},now).elapsedMs,null);
 assert.equal(formatDuration(1500),'1.5s');assert.equal(formatDuration(null),'not recorded');
});

test('Enter submits current authorized draft, Shift+Enter and composing/229 never send',()=>{
 let sent=0,prevented=0;
 const event=(changes:object={})=>({key:'Enter',shiftKey:false,nativeEvent:{isComposing:false,keyCode:13},preventDefault:()=>{prevented++;},...changes});
 handleComposerKeyDown(event(),true,()=>sent++);assert.equal(sent,1);assert.equal(prevented,1);
 for(const e of [event({repeat:true}),event({shiftKey:true}),event({key:'a'}),event({nativeEvent:{isComposing:true,keyCode:13}}),event({nativeEvent:{isComposing:false,keyCode:229}})])handleComposerKeyDown(e,true,()=>sent++);
 handleComposerKeyDown(event(),false,()=>sent++);assert.equal(sent,1);
});
test('bridge OFF only allows exact chat snapshot with explicit consent and a current nonblank draft',()=>{
 const state={bridgeReady:false,busy:false,authorize:true,message:'give me the current tasks and agent details',sessionKey:'thread-1',mode:'chat'};
 assert.equal(canSendMessage(state),true);
 for(const changes of [{authorize:false},{busy:true},{message:' '},{sessionKey:''},{mode:'task'},{message:state.message+' and restart all agents'}])assert.equal(canSendMessage({...state,...changes}),false);
 assert.equal(canSendMessage({...state,message:'real Hermes request',bridgeReady:true}),true);
});
test('synchronous submission guard rejects same-tick and in-flight duplicate sends until release',()=>{
 const guard=createSubmissionGuard();assert.equal(guard.acquire(),true);assert.equal(guard.acquire(),false);guard.release();assert.equal(guard.acquire(),true);
});
