import test from 'node:test';
import assert from 'node:assert/strict';
import {closeConversation,restoreWorkspace} from '../src/lib/messenger-state';
test('closing active tab selects neighbour, persists removal and leaves other tabs intact',()=>{
 const state={tabs:[{key:'one',agentId:'default'},{key:'two',agentId:'yana'},{key:'three',agentId:'jenny'}],activeKey:'two'};
 const next=closeConversation(state,'two',{key:'fresh',agentId:'default'});
 assert.deepEqual(next,{tabs:[state.tabs[0],state.tabs[2]],activeKey:'three'});
 assert.deepEqual(restoreWorkspace(JSON.stringify(next)),next);
 assert.equal(closeConversation({...state,activeKey:'one'},'two',{key:'fresh',agentId:'default'}).activeKey,'one');
});
test('closing last tab opens a fresh MIA conversation without deleting history',()=>{
 assert.deepEqual(closeConversation({tabs:[{key:'one',agentId:'yana'}],activeKey:'one'},'one',{key:'fresh',agentId:'default'}),{tabs:[{key:'fresh',agentId:'default'}],activeKey:'fresh'});
});
