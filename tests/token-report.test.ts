import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as report from '../src/lib/token-report';
const data={version:1,collectedAt:'2026-11-03T00:00:00.000Z',timezone:'Europe/Warsaw',attribution:'session-start',sources:[],rows:[]};
test('API report differentiates missing import, disconnected source, invalid data and stale empty import',async()=>{
 assert.equal(typeof report.loadTokenReport,'function');
 assert.equal((await report.loadTokenReport(async()=>null)).status,'not-imported');
 assert.equal((await report.loadTokenReport(async()=>{throw Error('SECRET connection');})).status,'disconnected');
 assert.equal((await report.loadTokenReport(async()=>({data:{...data,private:'SECRET'}}))).status,'invalid');
 const fresh=await report.loadTokenReport(async()=>({data}),Date.parse('2026-11-03T00:05:00Z'));
 assert.equal(fresh.status,'ready');assert.equal(fresh.stale,false);assert.deepEqual(fresh.snapshot?.rows,[]);
 assert.equal((await report.loadTokenReport(async()=>({data}),Date.parse('2026-11-03T01:00:00Z'))).stale,true);
});
