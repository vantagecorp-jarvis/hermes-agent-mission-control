import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('owner authorization stays selected until explicitly unchecked, without removing dispatch gates',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 assert.match(source,/mc-tool-authorization-v1/);
 assert.doesNotMatch(source,/setAuthorize\(false\)/);
 assert.match(source,/setAuthorize\(e.target.checked\)/);
 assert.match(source,/localStorage\.setItem\('mc-tool-authorization-v1'/);
 assert.match(source,/canSendMessage\(\{bridgeReady:ready,busy,authorize,message,sessionKey,mode\}\)/);
 assert.match(source,/if\(!sendAllowed\)return/);
 assert.match(source,/disabled=\{!sendAllowed\}/);
 assert.match(source,/Task · approval required/);
 assert.match(source,/until you untick/);
});
