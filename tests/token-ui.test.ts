import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as ui from '../src/components/token-optimization';
test('dashboard renders honest empty/disconnected states and real metric labels',()=>{
 assert.equal(typeof ui.TokenUsageView,'function');
 const empty=renderToStaticMarkup(createElement(ui.TokenUsageView,{report:{status:'not-imported',snapshot:null,stale:true}}));
 assert.match(empty,/No import yet/);assert.doesNotMatch(empty,/\$0\.00/);
 const disconnected=renderToStaticMarkup(createElement(ui.TokenUsageView,{report:{status:'disconnected',snapshot:null,stale:true}}));
 assert.match(disconnected,/Data store disconnected/);assert.match(disconnected,/<h2>Total tokens<\/h2><strong>Not available<\/strong>/);
 const ready=renderToStaticMarkup(createElement(ui.TokenUsageView,{report:{status:'ready',stale:true,snapshot:{version:1,collectedAt:'2026-11-03T00:00:00.000Z',timezone:'Europe/Warsaw',attribution:'session-start',sources:[],rows:[]}}}));
 assert.match(ready,/aria-label="Period"/);assert.match(ready,/aria-label="Agent"/);
 for(const label of ['Daily','Weekly','Monthly','All agents','Europe/Warsaw','Observed retrieval activity','Session-start attribution','No sessions in this selection','Not available','Stale'])assert.ok(ready.includes(label),label);
});
test('new page/API retain owner authentication and messenger navigation',()=>{
 assert.match(readFileSync('src/app/api/token-optimization/route.ts','utf8'),/ownerRequest/);
 assert.match(readFileSync('src/app/api/token-optimization/route.ts','utf8'),/no-store/);
 assert.match(readFileSync('src/app/token-optimization/page.tsx','utf8'),/getServerSession/);
 assert.match(readFileSync('src/components/mission-control.tsx','utf8'),/href="\/token-optimization"/);
});
