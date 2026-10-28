import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BridgeWorker} from '../hermes-bridge/core.mjs';
const row={id:'req',kind:'soul.write',agentId:'yana',sideEffecting:true,prompt:JSON.stringify({op:'soul.write',agentId:'yana',expectedVersion:'a'.repeat(64),content:'new'}),authorizedBy:'owner',authorizedAt:new Date(),decidedBy:'owner',decidedAt:new Date(),bootId:'boot'};
test('SOUL bridge allowlist invokes only approved current boot payload and persists real result',async()=>{
 let calls=0;const writes:any[]=[];const worker=new BridgeWorker({query:async(sql:string,args:any[])=>{writes.push([sql,args]);return {rows:sql.includes('candidate AS')?[row]:[]};}},()=>{throw Error('Must not call Hermes for SOUL');},async(b:any,c:any)=>{calls++;assert.equal(b.op,'soul.write');assert.equal(c.owner,'owner');return {saved:true,version:'b'.repeat(64),agentId:b.agentId,backupVersion:'a'.repeat(64),owner:'owner',requestId:c.requestId};});worker.bootId='boot';
 await worker.tick();assert.equal(calls,1);assert.ok(writes.some(([sql,args])=>sql.includes("status='done'")&&JSON.parse(args[1]).saved));
 for(const bad of [{decidedBy:null},{bootId:'stale'},{authorizedBy:null},{kind:'soul.delete'},{prompt:JSON.stringify({op:'soul.write',agentId:'default',expectedVersion:'a'.repeat(64),content:'wrong'})}])await assert.rejects(()=>worker.execute({...row,...bad}));assert.equal(calls,1);
});
test('SOUL read stays non-mutating and does not require write approval',async()=>{const worker=new BridgeWorker({},()=>{},async()=>({content:'actual',agentId:'yana',name:'YANA',profile:'/fixture/yana',source:'SOUL.md',version:'a'.repeat(64)}));worker.bootId='boot';const result=JSON.parse(await worker.execute({...row,kind:'soul.read',sideEffecting:false,decidedBy:null,decidedAt:null,prompt:JSON.stringify({op:'soul.read',agentId:'yana'})}));assert.equal(result.content,'actual');});
