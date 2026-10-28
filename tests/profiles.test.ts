import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registeredProfiles, validateAgentInput, agentInvocation } from '../hermes-bridge/profiles.mjs';

test('all registered identities use isolated homes, safe argv and named sessions without bypasses', () => {
  assert.deepEqual(registeredProfiles.map(p => p.id), ['default','yana','jenny','michael','michelle']);
  for (const profile of registeredProfiles) {
    const input = validateAgentInput({ agentId: profile.id, sessionKey: 'thread-1', message: 'literal $(touch /tmp/NO); `uname`', authorize: true, mode: 'chat' });
    const invocation = agentInvocation(input);
    assert.equal(invocation.env.HOME, '/opt/data');
    assert.equal(invocation.env.HERMES_HOME, profile.home);
    assert.equal(invocation.env.HERMES_PROFILE, profile.id);
    assert.equal((invocation.env as Record<string,string>).HERMES_YOLO_MODE, undefined);
    assert.equal(invocation.args.includes(`mc-${profile.id}-thread-1`), true);
    assert.equal(invocation.args.includes('--query-file'), true);
    assert.equal(invocation.args.includes('-'), true);
    assert.doesNotMatch(invocation.args.join(' '), /--yolo|--ignore|-z|touch/);
    assert.match(invocation.stdin, /literal \$\(touch/);
  }
});
test('voice transcript survives validation and safe invocation without executable argv', () => {
 const input=validateAgentInput({agentId:'yana',sessionKey:'thread-voice',message:'edited request',mode:'chat',authorize:true,inputMode:'voice',transcript:'initial recognition'});
 assert.equal(input.inputMode,'voice');assert.equal(input.transcript,'initial recognition');assert.match(agentInvocation(input).stdin,/edited request/);
 assert.throws(()=>validateAgentInput({...input,transcript:'\u0000'}));
});
test('profile paths, inherited history, arbitrary session references and missing consent fail closed', () => {
  for (const changes of [{agentId:'../default'}, {agentId:'/opt/data'}, {sessionKey:'../../state'}, {sessionKey:'latest'}, {message:''}, {message:'\u0000'}, {message:'x'.repeat(24001)}, {authorize:false}, {history:[]}, {mode:'shell'}]) {
    assert.throws(() => validateAgentInput({agentId:'default',sessionKey:'thread-1',message:'hello',authorize:true,mode:'chat',...changes}));
  }
});
