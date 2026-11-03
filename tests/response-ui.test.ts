import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('composer wires keyboard, conservative gate and synchronous HTTP guard while displaying in-flight read state',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 assert.match(source,/onKeyDown=\{e=>handleComposerKeyDown\(e,sendAllowed,send\)\}/);
 assert.match(source,/disabled=\{!sendAllowed\}/);
 assert.match(source,/submissionGuard.current.acquire\(\)/);
 assert.match(source,/submissionGuard.current.release\(\)/);
 assert.match(source,/setHttpPending\(\{.*message.*agentId.*sessionKey/);
 assert.match(source,/Reading database snapshot/);
 assert.match(source,/databaseDraft\?'I authorize this database-only read\.'/);
 assert.match(source,/Bridge OFF still blocks tool-enabled/);
 assert.match(source,/setRows\(previous=>/); // HTTP response rendered directly, not only after a poll
 assert.match(source,/\[rows,sessionKey,httpPending\]/);
});
test('inline response details show source, recorded clocks and one-second elapsed without a guessed countdown',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 assert.match(source,/responseProvenance\(r.kind\)/);assert.match(source,/responseTiming\(r,now\)/);
 assert.match(source,/setInterval\(\(\)=>setNow\(Date.now\(\)\),1000\)/);
 assert.match(source,/No reliable ETA/);assert.match(source,/Queue wait/);assert.match(source,/Execution/);
 assert.match(source,/Started:/);assert.match(source,/Finished:/);
 assert.doesNotMatch(source,/300000|remainingMs|response ETA/);
});
