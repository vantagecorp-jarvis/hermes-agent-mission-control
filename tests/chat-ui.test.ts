import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {conversationHistory, threadMessages} from '../src/lib/chat-history';

test('history is named by first prompt, newest first and isolated per recipient',()=>{
 const rows=[{id:'2',agentId:'default',sessionKey:'a',prompt:'Second',createdAt:'2026-01-02'}, {id:'1',agentId:'default',sessionKey:'a',prompt:'Plan my week',createdAt:'2026-01-01'}, {id:'3',agentId:'yana',sessionKey:'a',prompt:'Private Yana',createdAt:'2026-01-03'}];
 assert.deepEqual(conversationHistory(rows,'default'),[{key:'a',title:'Plan my week',updatedAt:'2026-01-02'}]);
 assert.deepEqual(threadMessages(rows,'default','a').map(r=>r.id),['1','2']);
});

test('composer keeps recipient, consent and real dispatch with drawer access',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 assert.match(source,/className="mc-composer"/);
 assert.match(source,/aria-label="Recipient"/);
 assert.match(source,/I authorize this real tool-enabled/);
 assert.match(source,/\/api\/hermes\/dispatch/);
 assert.match(source,/Approval inbox/);
 assert.match(source,/conversationHistory/);
});

test('landing opens the real chat rather than upstream dashboard',()=>{
 const source=readFileSync('src/app/page.tsx','utf8');
 assert.match(source, /<MissionControl/);
 assert.doesNotMatch(source,/HomeData|MetricCard|sampleSeries/);
});
