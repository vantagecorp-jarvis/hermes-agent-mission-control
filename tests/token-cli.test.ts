import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('collector CLI is explicit about dry-run/upload and rejects unknown flags without connecting',()=>{
 const run=(...args:string[])=>spawnSync(process.execPath,['--import','tsx','scripts/collect-token-usage.ts',...args],{encoding:'utf8'});
 const help=run('--help');assert.equal(help.status,0);assert.match(help.stdout,/--upload/);assert.match(help.stdout,/read-only/);
 const bad=run('--generate');assert.notEqual(bad.status,0);assert.doesNotMatch(bad.stderr,/postgres:\/\/|SECRET/);
});
