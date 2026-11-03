import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../hermes-bridge/token-store';
import type {TokenSnapshot} from '../src/lib/token-usage';
const snapshot:TokenSnapshot={version:1,collectedAt:'2026-11-03T00:00:00.000Z',timezone:'Europe/Warsaw',attribution:'session-start',sources:[],rows:[]};
test('ingestion replaces a fixed DataStore key idempotently and verifies exact readback',async()=>{
 assert.equal(typeof store.ingestTokens,'function');
 let value:unknown,rows=0;
 const db={query:async(sql:string,args?:unknown[])=>{
  assert.doesNotMatch(sql,/BridgeControl|AgentRequest|INSERT.*sessions/i);
  if(sql.startsWith('INSERT')){assert.match(sql,/ON CONFLICT/);assert.equal(args?.[0],'mc-token-usage-v1');rows=1;value=JSON.parse(args?.[1] as string);return {rows:[]};}
  return {rows:[{data:value}]};
 }};
 await store.ingestTokens(db,snapshot);await store.ingestTokens(db,snapshot);
 assert.equal(rows,1);assert.deepEqual(value,snapshot);
 await assert.rejects(()=>store.ingestTokens({query:async()=>({rows:[{data:{}}]})},snapshot),/verification/);
});
test('snapshot validation rejects private text, malformed telemetry and unknown extensions',()=>{
 assert.equal(typeof store.validTokenSnapshot,'function');
 assert.equal(store.validTokenSnapshot(snapshot),true);
 assert.equal(store.validTokenSnapshot({...snapshot,prompt:'SECRET'}),false);
 assert.equal(store.validTokenSnapshot({...snapshot,rows:[{content:'SECRET'}]}),false);
 assert.equal(store.validTokenSnapshot({...snapshot,collectedAt:'not a date'}),false);
});
