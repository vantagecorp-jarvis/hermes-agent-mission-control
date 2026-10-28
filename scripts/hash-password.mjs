#!/usr/bin/env node
// Read raw stdin, never argv/env, so passwords do not enter shell history or ps.
import { readFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
const password = readFileSync(0, 'utf8');
if (Buffer.byteLength(password) < 16 || Buffer.byteLength(password) > 1024) {
  console.error('Supply 16–1024 bytes of password on stdin, without a trailing newline.');
  process.exit(1);
}
const salt = randomBytes(16).toString('hex');
const key = scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
console.log(`scrypt$${salt}$${key.toString('hex')}`);
