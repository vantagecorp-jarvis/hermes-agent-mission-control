import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BridgeWorker} from '../hermes-bridge/core.mjs';
const request = { id:'req',kind:'bridge.agent',status:'running',agentId:'yana',sessionKey:'thread-1',prompt:'hello',sideEffecting:true,authorizedBy:'owner',authorizedAt:new Date(),decidedBy:'owner',decidedAt:new Date(),bootId:'boot' };
test('real authorized agent request reaches invocation and persists durable result', async()=>{
 const writes:any[]=[];
 const db={query:async(sql:string,args:any[])=>{writes.push([sql,args]); return {rows:sql.includes('candidate AS')?[request]:[]};}};
 const worker=new BridgeWorker(db,async(row:any)=>{assert.equal(row.agentId,'yana');return 'actual result';});
 worker.bootId='boot'; await worker.tick();
 assert.equal(writes.some(([sql,args])=>sql.includes("status='done'") && args[1]==='actual result'),true);
});
test('missing owner decision, cross-boot and legacy unsafe rows never execute', async()=>{
 let executions=0; const worker=new BridgeWorker({},async()=>{executions++;return 'x';}); worker.bootId='boot';
 for(const bad of [{decidedBy:null},{authorizedAt:null},{agentId:'../../default'},{bootId:'old'},{sideEffecting:false},{kind:'oneshot'}]) await assert.rejects(()=>worker.execute({...request,...bad}));
 assert.equal(executions,0);
});
test('provider errors persist failure without replay',async()=>{
 const writes:any[]=[]; const worker=new BridgeWorker({query:async(sql:string,args:any[])=>{writes.push([sql,args]);return {rows:sql.includes('candidate AS')?[request]:[]};}},async()=>{throw Error('Provider rejected request');});
 worker.bootId='boot';await worker.tick();assert.equal(writes.some(([sql,args])=>sql.includes("status='failed'") && args[1].includes('Provider rejected')),true);
});
