#!/usr/bin/env node
import pg from 'pg';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { BridgeWorker, databaseOptions, hermesInvocation } from './core.mjs';
import { agentInvocation } from './profiles.mjs';
import { profileSnapshot } from './reporting.mjs';
const options = databaseOptions(process.env.DATABASE_URL, process.env.BRIDGE_DB_TRANSPORT);
hermesInvocation(process.env.BRIDGE_HERMES_HOME); // Explicit default/MIA deployment safeguard.
const binary = process.env.HERMES_BIN;
if (!binary?.startsWith('/')) throw new Error('HERMES_BIN must be an operator-verified absolute CLI path');
const pool = new pg.Pool(options), lock = await pool.connect();
if (!(await lock.query('SELECT pg_try_advisory_lock(48192, 1) AS acquired')).rows[0].acquired) throw Error('Another bridge owns the queue');
lock.on('error',()=>process.exit(1));
const invoke = request => new Promise((resolve,reject)=>{
 const invocation = agentInvocation({agentId:request.agentId,sessionKey:request.sessionKey,message:request.prompt,mode:'chat',authorize:true});
 const child = spawn(binary,invocation.args,{cwd:invocation.cwd,env:invocation.env,stdio:['pipe','pipe','pipe'],detached:true});
 let stdout='',stderr='',settled=false;
 const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{} finish(Error('Agent timed out after 300 seconds; inspect profile session before retrying'));},300000);
 const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(stdout.trim());};
 child.stdout.on('data',chunk=>{stdout+=chunk; if(stdout.length>200000){try{process.kill(-child.pid,'SIGKILL');}catch{}finish(Error('Agent output exceeded 200000 characters; inspect profile session'));}});
 child.stderr.on('data',chunk=>{stderr=(stderr+chunk).slice(-4000);});
 child.on('error',finish); child.stdin.on('error',()=>{});
 child.on('close',code=>{if(code!==0)finish(Error(`Hermes exited ${code}: ${stderr || stdout.slice(-4000)}`));else if(!stdout.trim())finish(Error('Hermes returned an empty result'));else finish();});
 child.stdin.end(invocation.stdin);
});
const worker=new BridgeWorker(pool,invoke);
await worker.start(randomUUID());
// Do not perform a generation on startup. Validate the installed safe CLI contract.
const help=execFileSync(binary,['chat','--help'],{env:hermesInvocation('/opt/data').env,encoding:'utf8',timeout:15000});
for(const flag of ['--query-file','--create-if-missing','--run-budget','--source']) if(!help.includes(flag)) throw Error(`Installed CLI missing ${flag}; bridge remains OFF`);
console.log('Bridge OFF. Fresh owner password required. Registered profile tasks use normal policy-preserving chat CLI.');
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
// Heartbeat remains live during long agent execution. One claim at a time preserves thread order.
async function report(){const data=JSON.stringify(await profileSnapshot());await pool.query(`INSERT INTO "DataStore" (key,data,"updatedAt") VALUES ('mc-profiles',$1::jsonb,now()) ON CONFLICT (key) DO UPDATE SET data=$1::jsonb,"updatedAt"=now()`,[data]);}
await report();
const reporting=setInterval(()=>report().catch(()=>console.error('Profile snapshot unavailable')),30000);
const heartbeat=setInterval(()=>worker.heartbeat().catch(()=>process.exit(1)),3000);
while(!stopping){try{await worker.heartbeat();await worker.tick();}catch{console.error('Bridge control/database failure; exiting fail-closed');process.exit(1);}await new Promise(r=>setTimeout(r,1000));}
clearInterval(heartbeat);clearInterval(reporting);
await pool.query(`UPDATE "BridgeControl" SET enabled=false WHERE id='owner' AND "bootId"=$1`,[worker.bootId]);
lock.release();await pool.end();
