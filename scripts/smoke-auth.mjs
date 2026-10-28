// Production HTTP auth exercise with ephemeral generated credentials; no DB needed.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
const port = 33000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString('hex');
const hash = spawnSync(process.execPath, ['scripts/hash-password.mjs'], { input: password, encoding: 'utf8' });
assert.equal(hash.status, 0);
assert.match(hash.stdout.trim(), /^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
const [, salt, key] = hash.stdout.trim().split('$');
assert.equal(scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }).toString('hex'), key);
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], {
  env: { PATH: process.env.PATH, NODE_ENV: 'production', NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString('hex'), OWNER_PASSWORD_HASH: hash.stdout.trim(), NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let diagnostics = '';
server.stdout.on('data', d => { diagnostics += d; });
server.stderr.on('data', d => { diagnostics += d; });
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(base + '/login')).status === 200) { ready = true; break; } } catch { /* waiting for startup */ }
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, diagnostics);
  const routes = readdirSync('src/app/api', { recursive: true }).filter(p => p.endsWith('route.ts') && !p.startsWith('auth/')).map(p => '/api/' + p.replace(/\/route.ts$/, '').replace('[id]', 'probe'));
  for (const route of routes) {
    const response = await fetch(base + route, { headers: { 'x-internal-secret': 'not-an-auth-method', cookie: 'hermyhq_auth=ignored' }, redirect: 'manual' });
    assert.equal(response.status, 401, route);
  }
  const providers = await (await fetch(base + '/api/auth/providers')).json();
  assert.deepEqual(Object.keys(providers), ['credentials']);
  const csrf = await fetch(base + '/api/auth/csrf');
  const { csrfToken } = await csrf.json();
  const cookies = csrf.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const signin = async value => fetch(base + '/api/auth/callback/credentials', {
    method: 'POST', redirect: 'manual', headers: { cookie: cookies, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, password: value, json: 'true', callbackUrl: base + '/' }),
  });
  assert.equal((await signin(randomBytes(24).toString('hex'))).status, 401);
  const login = await signin(password);
  assert.equal(login.status, 200);
  const sessionCookie = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  assert.match(sessionCookie, /next-auth.session-token=/);
  const authorized = await fetch(base + '/api/auth/login', { method: 'POST', headers: { cookie: sessionCookie } });
  assert.equal(authorized.status, 410); // reaches retired handler, not middleware 401
  const session = await (await fetch(base + '/api/auth/session', { headers: { cookie: sessionCookie } })).json();
  assert.equal(session.user.id, 'owner');
  const forbidden = await fetch(base + '/api/hermes/dispatch', { method: 'POST', headers: { cookie: sessionCookie, origin: 'https://attacker.invalid' } });
  assert.equal(forbidden.status, 403);
  console.log(`PASS: ${routes.length} private API routes return 401; Credentials-only provider; real CSRF + wrong/correct login; JWT owner session; retired plaintext login 410; cross-origin POST 403; hash generator round-trip.`);
} finally {
  server.kill('SIGTERM');
  await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
