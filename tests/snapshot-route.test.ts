import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('dispatch checks owner and authorization before DB-only admission; task and bridge gates remain',()=>{
 const source=readFileSync('src/app/api/hermes/dispatch/route.ts','utf8');
 assert.ok(source.indexOf('ownerRequest(req)')<source.indexOf('createDashboardSnapshot(prisma, b)'));
 assert.ok(source.indexOf('validateAgentInput(b)')<source.indexOf('createDashboardSnapshot(prisma, b)'));
 assert.ok(source.indexOf('createDashboardSnapshot(prisma, b)')<source.indexOf("typeof b.bootId"));
 assert.match(source,/Snapshot unavailable; no answer generated/);
 assert.match(source,/input.mode === 'task' \? 'awaiting_approval' : 'approved'/);
 assert.match(source,/enabled=true AND "bootId"=\$\{b.bootId\}/);
 const approval=readFileSync('src/app/api/hermes/requests/[id]/route.ts','utf8');
 assert.match(approval,/ownerRequest\(req\)/);assert.match(approval,/awaiting_approval/);
});
