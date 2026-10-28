import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreWorkspace,openConversation,readShortcuts,searchHistory} from '../src/lib/messenger-state';

test('tabs restore last conversation and retain each actual recipient',()=>{
 const state=openConversation({tabs:[{key:'one',agentId:'default'}],activeKey:'one'},{key:'two',agentId:'yana'});
 assert.equal(state.activeKey,'two');
 assert.equal(restoreWorkspace(JSON.stringify(state))?.tabs[1].agentId,'yana');
 assert.equal(openConversation(state,{key:'one',agentId:'default'}).tabs.length,2);
 assert.equal(restoreWorkspace('broken'),null);
});
test('persistent shortcuts validate saved edits and preserve deliberate empty list',()=>{
 const shortcut={id:'s',label:'Review',agentId:'yana',prompt:'Review my draft',mode:'task'};
 assert.deepEqual(readShortcuts(JSON.stringify([shortcut])),[shortcut]);
 assert.deepEqual(readShortcuts('[]'),[]);
 assert.equal(readShortcuts('{}'),null);
 assert.equal(readShortcuts('[{"label":"unsafe"}]'),null);
});
test('history search matches prompt bodies case insensitively, scoped to agent',()=>{
 const rows=[{agentId:'default',sessionKey:'a',prompt:'hello',createdAt:'2026-01-01'},{agentId:'default',sessionKey:'a',prompt:'Budget REVIEW',createdAt:'2026-01-02'},{agentId:'yana',sessionKey:'b',prompt:'budget',createdAt:'2026-01-02'}];
 assert.deepEqual(searchHistory(rows,'default',' budget ').map(t=>t.key),['a']);
 assert.deepEqual(searchHistory(rows,'default','absent'),[]);
});
