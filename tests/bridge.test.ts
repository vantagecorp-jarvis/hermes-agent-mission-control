import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { freshPasswordGate, operationPolicy, controlOriginAllowed } from '../src/lib/bridge-security';

const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }).toString('hex')}`;

test('fresh enable password uses owner scrypt, throttles globally and serializes attempts', async () => {
  let now = 100000;
  const gate = freshPasswordGate(() => now);
  assert.equal(await gate('wrong', hash), false);
  assert.equal(await gate(password, hash), true);
  for (let i = 0; i < 8; i++) await gate('wrong', hash);
  assert.equal(await gate(password, hash), false);
  now += 60001;
  const first = gate(password, hash);
  assert.equal(await gate(password, hash), false);
  assert.equal(await first, true);
});

test('caller cannot label execution or mutations safe; unknown operations fail closed', () => {
  for (const kind of ['oneshot', 'chat', 'kanban', 'cron.run', 'cron.pause', 'cron.resume', 'memory.write', 'briefing.generate', 'unknown']) {
    assert.deepEqual(operationPolicy(kind), { supported: false, approvalRequired: true });
  }
  assert.deepEqual(operationPolicy('hermes.version'), { supported: true, approvalRequired: false });
});

test('control requires explicit canonical same-origin, rejecting absent/null and cross-site origins', () => {
  const url = 'https://hq.example';
  for (const origin of [null, 'null', 'https://evil.example', 'https://hq.example.evil']) {
    assert.equal(controlOriginAllowed(new Headers(origin ? { origin } : {}), url), false);
  }
  assert.equal(controlOriginAllowed(new Headers({ origin: url }), url), true);
  assert.equal(controlOriginAllowed(new Headers({ origin: url, 'sec-fetch-site': 'cross-site' }), url), false);
});
