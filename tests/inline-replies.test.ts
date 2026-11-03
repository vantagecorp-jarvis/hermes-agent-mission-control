import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('agent replies stay in scrollable same-page region above composer with latest-reply navigation',()=>{
 const source=readFileSync('src/components/mission-control.tsx','utf8');
 assert.ok(source.indexOf('className="mc-conversation"')<source.indexOf('className="mc-compose-dock"'));
 assert.match(source,/aria-label="Show latest reply"/);
 assert.match(source,/function showLatestReply/);
 assert.match(source,/data-agent-reply/);
 assert.match(source,/r\.result&&<div className="mc-result"/);
 const css=readFileSync('src/app/messenger.css','utf8');
 assert.match(css,/\.mc-conversation\{[^}]*overflow-y:auto/);
});
