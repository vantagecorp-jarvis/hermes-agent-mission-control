import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('recipient uses the clickable native select arrow and real registered options, never a sibling fake arrow',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 const css=readFileSync('src/app/messenger.css','utf8');
 assert.match(css,/\.mc-recipient select\{appearance:auto/);
 assert.doesNotMatch(source,/<ChevronDown/);
 assert.match(source,/<select aria-label="Recipient"[^>]*value=\{agentId\}/);
 assert.match(source,/onChange=\{e=>selectAgent\(e.target.value\)\}/);
 assert.match(source,/agents.length\?agents:/);
 assert.match(source,/<option value=\{a.id\} key=\{a.id\}>\{a.name\}<\/option>/);
});
