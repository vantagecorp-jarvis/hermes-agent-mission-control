import { test } from 'node:test';
import assert from 'node:assert/strict';
import { databaseOptions, hermesInvocation, BridgeWorker } from '../hermes-bridge/core.mjs';

test('transport rejects public/nonverified DB and profile is fixed to default', () => {
  assert.throws(() => databaseOptions('postgres://u:p@public.example/db', 'private'));
  assert.throws(() => databaseOptions('postgres://u:p@db/db?sslmode=no-verify', 'private'));
  assert.equal(databaseOptions('postgres://u:p@db/db', 'private').ssl, false);
  assert.deepEqual(databaseOptions('postgres://u:p@db.internal/db', 'tls').ssl, { rejectUnauthorized: true });
  const invocation = hermesInvocation('/opt/data');
  assert.deepEqual(invocation.args, ['--version']);
  assert.equal(invocation.env.HERMES_HOME, '/opt/data');
  assert.equal(invocation.env.HERMES_PROFILE, 'default');
  assert.throws(() => hermesInvocation('/opt/data/profiles/other'));
});

test('worker never invokes unsupported kinds or unsafe wiki paths even if approved', async () => {
  let executions = 0;
  const worker = new BridgeWorker({ query: async () => ({ rows: [] }) }, async () => { executions++; return 'ok'; });
  for (const kind of ['oneshot', 'chat', 'cron.run', 'memory.write', 'briefing.generate']) {
    await assert.rejects(() => worker.execute({ kind, status: 'approved', sideEffecting: false, prompt: '../../secrets' }));
  }
  assert.equal(executions, 0);
  assert.equal(await worker.execute({ kind: 'hermes.version', sideEffecting: false }), 'ok');
});
