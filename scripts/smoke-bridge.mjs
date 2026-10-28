// Requires an EMPTY disposable local database, never production. Uses generated auth credentials.
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import { BridgeWorker } from '../hermes-bridge/core.mjs';
const dbURL = process.env.TEST_BRIDGE_DATABASE_URL;
const target = new URL(dbURL);
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.pathname, '/mission_bridge_test');
const db = new pg.Pool({ connectionString: dbURL });
const port = 34721;
const base = `http://127.0.0.1:${port}`;
const password = randomBytes(24).toString('hex'), salt = randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 67108864 }).toString('hex')}`;
const env = { PATH: process.env.PATH, NODE_ENV: 'production', NEXTAUTH_URL: base, NEXTAUTH_SECRET: randomBytes(32).toString('hex'), OWNER_PASSWORD_HASH: hash, DATABASE_URL: dbURL, NEXT_TELEMETRY_DISABLED: '1' };
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let bridge, output = '';
server.stderr.on('data', d => output += d);
server.stdout.on('data', d => output += d);
async function until(check) { for (let i = 0; i < 150; i++) { const value = await check(); if (value) return value; await new Promise(r => setTimeout(r, 100)); } throw Error('Timed out: ' + output); }
async function stop(child) { if (!child || child.exitCode !== null) return; child.kill('SIGTERM'); await new Promise(r => child.once('exit', r)); }
async function startBridge() {
  bridge = spawn(process.execPath, ['hermes-bridge/bridge.mjs'], { env: { PATH: process.env.PATH, DATABASE_URL: dbURL, BRIDGE_DB_TRANSPORT: 'private', BRIDGE_HERMES_HOME: '/opt/data', HERMES_BIN: '/usr/local/bin/hermes' }, stdio: ['ignore', 'pipe', 'pipe'] });
  bridge.stdout.on('data', d => output += d); bridge.stderr.on('data', d => output += d);
}
try {
  await db.query('TRUNCATE "AgentRequest", "BridgeControl"');
  await until(async () => { try { return (await fetch(base + '/login')).ok; } catch { return false; } });
  assert.equal((await fetch(base + '/api/hermes/bridge')).status, 401);
  const csrf = await fetch(base + '/api/auth/csrf');
  const { csrfToken } = await csrf.json();
  const cookie = csrf.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  const login = await fetch(base + '/api/auth/callback/credentials', { method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ csrfToken, password, json: 'true' }), redirect: 'manual' });
  assert.equal(login.status, 200);
  const session = login.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
  async function api(path, body, origin = base) {
    return fetch(base + '/api/hermes/' + path, { method: body ? 'POST' : 'GET', headers: { cookie: session, ...(body ? { 'content-type': 'application/json', ...(origin ? { origin } : {}) } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const state = async () => (await api('bridge')).json();
  await startBridge();
  const initial = await until(async () => { const s = await state(); return s.online && s; });
  assert.equal(initial.enabled, false);
  assert.equal((await api('dispatch', { kind: 'hermes.version' })).status, 409);
  assert.equal((await api('bridge', { enabled: true, bootId: initial.bootId, password: 'wrong' })).status, 403);
  assert.equal((await state()).enabled, false);
  const duplicate = spawn(process.execPath, ['hermes-bridge/bridge.mjs'], { env: { PATH: process.env.PATH, DATABASE_URL: dbURL, BRIDGE_DB_TRANSPORT: 'private', BRIDGE_HERMES_HOME: '/opt/data', HERMES_BIN: '/usr/local/bin/hermes' }, stdio: 'ignore' });
  const duplicateCode = await new Promise(resolve => duplicate.once('exit', resolve));
  assert.notEqual(duplicateCode, 0);
  assert.equal((await state()).bootId, initial.bootId);
  for (const origin of [null, 'https://evil.invalid']) assert.equal((await api('bridge', { enabled: true, bootId: initial.bootId, password }, origin)).status, 403);
  assert.equal((await api('bridge', { enabled: true, bootId: initial.bootId, password })).status, 200);
  assert.equal((await state()).enabled, true);
  for (const kind of ['oneshot','chat','memory.write','cron.run','briefing.generate','kanban']) assert.equal((await api('dispatch', { kind, sideEffecting: false })).status, 403);
  for (const path of ['../../outside.md', '/tmp/outside.md', 'symlink/escape.md']) assert.equal((await api('memory', { title: 'blocked', path, body: 'unsafe' })).status, 403);
  const queued = await api('dispatch', { kind: 'hermes.version', sideEffecting: false, prompt: '--yolo -z never' });
  assert.equal(queued.status, 200);
  const request = (await queued.json()).request;
  await until(async () => (await db.query('SELECT * FROM "AgentRequest" WHERE id=$1', [request.id])).rows[0]?.status === 'done');
  assert.match((await db.query('SELECT result FROM "AgentRequest" WHERE id=$1', [request.id])).rows[0].result, /^Hermes Agent v/);
  assert.equal((await api('bridge', { enabled: false, bootId: initial.bootId })).status, 200);
  assert.equal((await state()).enabled, false);
  assert.equal((await api('dispatch', { kind: 'hermes.version' })).status, 409);
  await stop(bridge);
  await startBridge();
  const restarted = await until(async () => { const s = await state(); return s.online && s.bootId !== initial.bootId && s; });
  assert.equal(restarted.enabled, false);
  assert.equal((await api('bridge', { enabled: true, bootId: initial.bootId, password })).status, 409);
  assert.equal((await api('bridge', { enabled: true, bootId: restarted.bootId })).status, 403);
  for (let i = 0; i < 10; i++) assert.equal((await api('bridge', { enabled: true, bootId: restarted.bootId, password: 'wrong' })).status, 403);
  assert.equal((await api('bridge', { enabled: true, bootId: restarted.bootId, password })).status, 403);
  assert.equal((await state()).enabled, false);
  await stop(bridge); bridge = null;
  // Real PostgreSQL concurrent claims, independent workers (no SQL mocks).
  const worker = new BridgeWorker(db, async () => 'ok');
  await worker.start(randomUUID());
  assert.equal(await worker.claim(), null);
  const id = randomUUID();
  await db.query(`INSERT INTO "AgentRequest" (id, origin, kind, title, "sideEffecting", status, "createdAt", "updatedAt") VALUES ($1,'test','hermes.version','test',false,'queued',now(),now())`, [id]);
  await db.query(`UPDATE "BridgeControl" SET enabled=true`);
  const claims = await Promise.all(Array.from({ length: 20 }, () => worker.claim()));
  assert.equal(claims.filter(Boolean).length, 1);
  // OFF does not change an already claimed task; no new claims after OFF.
  await db.query(`UPDATE "BridgeControl" SET enabled=false`);
  assert.equal((await db.query('SELECT status FROM "AgentRequest" WHERE id=$1', [id])).rows[0].status, 'running');
  assert.equal(await worker.claim(), null);
  await worker.start(randomUUID());
  assert.equal((await db.query('SELECT enabled FROM "BridgeControl"')).rows[0].enabled, false);
  for (const status of ['queued','approved']) await db.query(`INSERT INTO "AgentRequest" (id, origin, kind, title, "sideEffecting", status, "createdAt", "updatedAt") VALUES ($1,'test','oneshot','blocked',false,$2,now(),now())`, [randomUUID(), status]);
  await db.query('UPDATE "BridgeControl" SET enabled=true');
  assert.equal(await worker.claim(), null);
  // A stale heartbeat must close claims even if a stored enabled flag remains true.
  await db.query(`UPDATE "BridgeControl" SET "heartbeatAt"=now()-interval '1 minute'`);
  assert.equal(await worker.claim(), null);
  console.log('PASS: real HTTP owner auth + fresh wrong/correct/missing password; same-origin/missing-origin protection; startup/restart OFF; stale boot rejected; disable blocks ingress/claims and preserves running; actual installed Hermes version execution; caller approval bypass blocked; wiki traversal/absolute/symlink write requests blocked; 20 concurrent PostgreSQL claims execute exactly once; legacy queued/approved prompts unclaimable.');
} finally { await stop(bridge); await stop(server); await db.end(); }
