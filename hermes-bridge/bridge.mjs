#!/usr/bin/env node
import pg from 'pg';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { BridgeWorker, databaseOptions, hermesInvocation } from './core.mjs';

const options = databaseOptions(process.env.DATABASE_URL, process.env.BRIDGE_DB_TRANSPORT);
const invocation = hermesInvocation(process.env.BRIDGE_HERMES_HOME);
const binary = process.env.HERMES_BIN;
if (!binary?.startsWith('/')) throw new Error('HERMES_BIN must be an operator-verified absolute CLI path');
const exec = promisify(execFile);
const pool = new pg.Pool(options);
const lock = await pool.connect();
// Hold a dedicated session lock for lifetime: second bridge cannot reset a live bridge.
const acquired = await lock.query('SELECT pg_try_advisory_lock(48192, 1) AS acquired');
if (!acquired.rows[0].acquired) throw new Error('Another bridge already owns the queue');
lock.on('error', () => process.exit(1));
const invoke = async () => {
  const { stdout } = await exec(binary, invocation.args, { env: invocation.env, cwd: invocation.cwd, timeout: 10000, maxBuffer: 65536 });
  const version = stdout.trim();
  if (!/^Hermes Agent v\d+\.\d+\.\d+[^\n]*(?:\n[^\n]*)*$/i.test(version)) throw new Error('Unvalidated Hermes CLI version contract');
  return version;
};
const worker = new BridgeWorker(pool, invoke);
await worker.start(randomUUID());
// Validate only the non-agent --version contract; no model runs or inherited secrets.
try { console.log('CLI contract:', await invoke()); }
catch { console.error('CLI contract validation failed; bridge remains OFF'); lock.release(); await pool.end(); process.exit(1); }
console.log('Bridge OFF. Owner must freshly authenticate to enable. Only hermes.version supported.');
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopping = true; });
while (!stopping) {
  try { await worker.heartbeat(); await worker.tick(); }
  catch { console.error('Bridge database/control failure; exiting fail-closed'); process.exit(1); }
  await new Promise(resolve => setTimeout(resolve, 1000));
}
await pool.query(`UPDATE "BridgeControl" SET enabled=false WHERE id='owner' AND "bootId"=$1`, [worker.bootId]);
lock.release();
await pool.end();
