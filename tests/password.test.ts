import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { verifyPassword } from '../src/lib/password';

const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
test('only the correct password verifies against the scrypt hash', async () => {
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(randomBytes(24).toString('hex'), hash), false);
});
test('missing, malformed and oversized inputs fail closed', async () => {
  for (const malformed of [undefined, '', 'plaintext', 'scrypt$a$b', hash + '$extra']) {
    assert.equal(await verifyPassword(password, malformed), false);
  }
  for (const input of [undefined, '', {}, 'x'.repeat(1025)]) {
    assert.equal(await verifyPassword(input, hash), false);
  }
});
