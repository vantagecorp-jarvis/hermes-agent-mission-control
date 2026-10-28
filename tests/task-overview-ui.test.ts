import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('task overview preserves real assignments, outcomes and MIA oversight without a delegation backend',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 assert.match(source,/MIA coordinates/);
 assert.match(source,/Task overview/);
 assert.match(source,/taskRows\.map/);
 assert.doesNotMatch(source,/all\.requests\.filter/,'dispatch persists bridge.agent for chat and approval tasks, so do not hide them with a fictitious task kind');
 assert.match(source,/r\.status/);
 assert.match(source,/r\.result/);
 assert.match(readFileSync('src/app/tasks/page.tsx','utf8'),/initialPanel="tasks"/);
});
