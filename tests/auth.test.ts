import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { authOptions } from '../src/lib/auth';
import { middleware } from '../src/middleware';
import { NextRequest } from 'next/server';
import { encode } from 'next-auth/jwt';

const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
process.env.OWNER_PASSWORD_HASH = `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }).toString('hex')}`;
process.env.NEXTAUTH_SECRET = randomBytes(32).toString('hex');
process.env.NEXTAUTH_URL = 'http://localhost:3000';

test('Credentials provider authenticates only the configured owner password', async () => {
  const provider = authOptions.providers[0];
  assert.equal(provider.id, 'credentials');
  const authorize = (provider as unknown as { options: { authorize: (c: unknown, r: unknown) => Promise<unknown> } }).options.authorize;
  assert.equal(await authorize({ password: randomBytes(24).toString('hex') }, {}), null);
  assert.deepEqual(await authorize({ password }, {}), { id: 'owner', name: 'Owner' });
});

test('private API rejects anonymous, legacy cookies, and internal secret bypass', async () => {
  process.env.INTERNAL_API_SECRET = randomBytes(24).toString('hex');
  for (const path of ['/api/garden', '/api/home', '/api/hermes/dispatch', '/api/auth/login', '/api/auth/anything']) {
    const response = await middleware(new NextRequest('http://localhost:3000' + path, { headers: {
      'x-internal-secret': process.env.INTERNAL_API_SECRET, cookie: 'hermyhq_auth=anything',
    } }));
    assert.equal(response.status, 401, path);
  }
});

test('JWT owner session passes, stale/foreign sessions fail, cross-origin mutation fails', async () => {
  const version = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(process.env.OWNER_PASSWORD_HASH));
  const credentialVersion = Buffer.from(version).toString('hex');
  const cookie = async (sub: string, version: string) => 'next-auth.session-token=' + await encode({
    secret: process.env.NEXTAUTH_SECRET!, token: { sub, credentialVersion: version }, maxAge: 3600,
  });
  for (const [sub, version, expected] of [['owner', credentialVersion, 200], ['google-user', credentialVersion, 401], ['owner', 'old', 401]] as const) {
    const response = await middleware(new NextRequest('http://localhost:3000/api/home', { headers: { cookie: await cookie(sub, version) } }));
    assert.equal(response.status, expected, `${sub}/${version}`);
  }
  const response = await middleware(new NextRequest('http://localhost:3000/api/hermes/dispatch', { method: 'POST', headers: {
    cookie: await cookie('owner', credentialVersion), origin: 'https://attacker.invalid',
  } }));
  assert.equal(response.status, 403);
});

test('only exact NextAuth endpoints and login/static resources are public', async () => {
  for (const path of ['/login', '/api/auth/csrf', '/api/auth/providers', '/api/auth/session', '/_next/static/test.js']) {
    assert.equal((await middleware(new NextRequest('http://localhost:3000' + path))).status, 200, path);
  }
  assert.equal((await middleware(new NextRequest('http://localhost:3000/'))).status, 307);
});
