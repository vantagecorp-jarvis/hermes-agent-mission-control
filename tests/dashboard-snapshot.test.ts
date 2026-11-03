import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDashboardSnapshot} from '../src/lib/dashboard-snapshot';
const input={agentId:'yana',sessionKey:'thread-1',message:'give me the current tasks and agent details',mode:'chat',authorize:true};
function fixture(fail=false){
 const calls:string[]=[];let stored:any;
 const db:any={$transaction:async(fn:any,options:any)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn({
  agentRequest:{groupBy:async()=>{calls.push('counts');if(fail)throw Error('database unavailable');return [{kind:'bridge.agent',status:'awaiting_approval',_count:{_all:2}},{kind:'soul.read',status:'done',_count:{_all:1}}];},findMany:async(args:any)=>{calls.push('recent');assert.equal(args.take,10);assert.deepEqual(args.where,{kind:'bridge.agent'});return [{id:'task-1',title:'Review priorities',agentId:'default',status:'awaiting_approval',createdAt:new Date('2026-01-01')}];},create:async({data}:any)=>{calls.push('insert');stored={id:'snapshot-1',...data};return stored;}},
  dataStore:{findUnique:async(args:any)=>{calls.push('metadata');assert.equal(args.where.key,'mc-profiles');return {updatedAt:new Date('2026-01-02'),data:{yana:{observedAt:'2026-01-02',sessionStorePresent:true,crons:[{id:'cron'}],error:null}}};}}
 });}};return {db,calls,get stored(){return stored;}};
}
test('authorized chat reads the pre-insert DB snapshot then persists actual identity, decision and timing without execution',async()=>{
 const f=fixture();const row=await createDashboardSnapshot(f.db,input);
 assert.ok(row);assert.ok(row.result);assert.ok(row.startedAt);assert.ok(row.finishedAt);
 assert.equal(row.kind,'dashboard.snapshot');assert.equal(row.status,'done');assert.equal(row.sideEffecting,false);
 assert.equal(row.agentId,'yana');assert.equal(row.sessionKey,'thread-1');assert.equal(row.prompt,input.message);
 assert.equal(row.authorizedBy,'owner');assert.equal(row.decidedBy,'owner');assert.ok(row.authorizedAt);assert.ok(row.decidedAt);
 assert.ok(row.finishedAt>=row.startedAt);assert.ok(row.startedAt>=row.createdAt);
 assert.equal(f.calls.at(-1),'insert');assert.match(row.result,/DB snapshot \(no LLM\)/);
 assert.match(row.result,/bridge.agent.*awaiting_approval.*2/);assert.match(row.result,/soul.read.*done.*1/);
 assert.match(row.result,/Review priorities/);assert.match(row.result,/latest 10/);assert.match(row.result,/not all fleet activity/);
 assert.match(row.result,/5 registered agents/);assert.match(row.result,/YANA.*2026-01-02/);assert.match(row.result,/runtime health.*unknown/i);
 assert.match(row.result,/Bridge OFF.*tool-enabled/i);assert.match(row.result,/mc-profiles/);
});
test('task mode and unrecognized instructions never become completed DB work',async()=>{
 const f=fixture();assert.equal(await createDashboardSnapshot(f.db,{...input,mode:'task'}),null);
 assert.equal(await createDashboardSnapshot(f.db,{...input,message:input.message+' and restart them'}),null);
 assert.deepEqual(f.calls,[]);
});
test('authorization and registered identity fail closed even for database-only intent',async()=>{
 for(const change of [{authorize:false},{agentId:'../default'},{sessionKey:'latest'},{history:[]}]){
  const f=fixture();await assert.rejects(()=>createDashboardSnapshot(f.db,{...input,...change}));assert.deepEqual(f.calls,[]);
 }
});
test('database failure yields no fabricated answer or completed record',async()=>{
 const f=fixture(true);await assert.rejects(()=>createDashboardSnapshot(f.db,input),/database unavailable/);
 assert.equal(f.stored,undefined);assert.ok(!f.calls.includes('insert'));
});
