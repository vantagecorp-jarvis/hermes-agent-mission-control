import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as usage from '../src/lib/token-usage';
test('Warsaw civil dates respect both DST boundaries and Monday/calendar month periods',()=>{
 assert.equal(typeof usage.dayFor,'function');
 assert.equal(usage.dayFor(Date.parse('2026-03-28T23:30:00Z')/1000),'2026-03-29');
 assert.equal(usage.dayFor(Date.parse('2026-03-29T22:30:00Z')/1000),'2026-03-30');
 assert.equal(usage.dayFor(Date.parse('2026-10-25T22:30:00Z')/1000),'2026-10-25');
 assert.equal(usage.dayFor(Date.parse('2026-10-25T23:30:00Z')/1000),'2026-10-26');
 assert.equal(usage.periodFor('2027-01-01','weekly'),'2026-12-28');
 assert.equal(usage.periodFor('2026-03-31','monthly'),'2026-03-01');
});
test('subscription included costs are unavailable even when stores contain an estimate',()=>{
 const m=usage.metricsFor({input_tokens:1,actual_cost_usd:0,estimated_cost_usd:99,cost_status:'included'});
 assert.equal(m.actualUsd,null);assert.equal(m.estimatedUsd,null);assert.equal(m.includedCost,1);
});
test('period/agent selection preserves unknowns, partial costs and observed-only denominator',()=>{
 assert.equal(typeof usage.summarizeUsage,'function');
 const metrics=usage.metricsFor({input_tokens:100,estimated_cost_usd:0.2});
 const rows=[{day:'2026-11-01',agentId:'default',sessions:4,auxiliaryRecords:0,metrics,retrieval:{kb:1,external:1,mixed:1,unknown:1},kbCalls:1,externalCalls:2,incompleteSessions:0},
 {day:'2026-11-02',agentId:'yana',sessions:1,auxiliaryRecords:0,metrics,retrieval:{kb:0,external:0,mixed:0,unknown:1},kbCalls:0,externalCalls:0,incompleteSessions:0}];
 const s=usage.summarizeUsage(rows,'weekly','default','2026-10-26','2026-11-01');
 assert.equal(s.rows.length,1);assert.equal(s.totals.sessions,4);assert.equal(s.kbOnlyPercent,100/3);
 assert.equal(s.totals.metrics.actualUsd,null);assert.equal(s.totals.retrieval.unknown,1);
 const empty=usage.summarizeUsage(rows,'daily','michelle');assert.equal(empty.rows.length,0);assert.equal(empty.kbOnlyPercent,null);assert.equal(empty.totals.metrics.actualUsd,null);
});
test('canonical session counters keep uncached input separate from cache and reasoning is not added twice',()=>{
 assert.equal(typeof usage.metricsFor,'function');
 const m=usage.metricsFor({input_tokens:100,output_tokens:20,cache_read_tokens:80,cache_write_tokens:10,reasoning_tokens:5,estimated_cost_usd:null,actual_cost_usd:null});
 assert.equal(m.total,210);assert.equal(m.input,100);assert.equal(m.cacheRead,80);assert.equal(m.reasoning,5);
 assert.equal(m.actualUsd,null);assert.equal(m.estimatedUsd,null);assert.equal(m.missingCost,1);
});
