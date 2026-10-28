// Isolated real PostgreSQL + production HTTP test; agent invocation is an explicit test double.
// This proves queue/auth/persistence, NOT real provider generation.
import {spawn} from 'node:child_process';
import {randomBytes,scryptSync,randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import pg from 'pg';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSoulManager} from '../hermes-bridge/soul.mjs';
import {BridgeWorker} from '../hermes-bridge/core.mjs';
const url=process.env.TEST_BRIDGE_DATABASE_URL,target=new URL(url);
assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/mission_bridge_test');
const db=new pg.Pool({connectionString:url}),base='http://127.0.0.1:34721';
const password=randomBytes(24).toString('hex'),salt=randomBytes(16).toString('hex');
const hash=`scrypt$${salt}$${scryptSync(password,salt,64,{N:32768,r:8,p:1,maxmem:67108864}).toString('hex')}`;
const env={PATH:process.env.PATH,NODE_ENV:'production',NEXTAUTH_URL:base,NEXTAUTH_SECRET:randomBytes(32).toString('hex'),OWNER_PASSWORD_HASH:hash,DATABASE_URL:url,NEXT_TELEMETRY_DISABLED:'1'};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','34721'],{env,stdio:['ignore','pipe','pipe']});
let output='';server.stderr.on('data',d=>output+=d);server.stdout.on('data',d=>output+=d);
async function until(check){for(let i=0;i<120;i++){const value=await check();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+output);}
const fixtureRoot=await mkdtemp(join(tmpdir(),'mc-http-soul-'));
const fixtures=await Promise.all(['default','yana','jenny','michael','michelle'].map(async id=>{const home=join(fixtureRoot,id);await mkdir(home);await writeFile(join(home,'SOUL.md'),`fixture actual ${id}`);return {id,name:id,home};}));
try{
 await db.query('TRUNCATE "AgentRequest", "BridgeControl"');
 await until(async()=>{try{return(await fetch(base+'/login')).ok;}catch{return false;}});
 for(const p of ['/api/hermes/dispatch','/api/hermes/requests','/api/agents'])assert.equal((await fetch(base+p)).status,401);
 const csrf=await fetch(base+'/api/auth/csrf'),{csrfToken}=await csrf.json();
 const cookie=csrf.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 const login=await fetch(base+'/api/auth/callback/credentials',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrfToken,password,json:'true'}),redirect:'manual'});
 const session=login.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
 async function api(path,body,method=body?'POST':'GET',origin=base){return fetch(base+path,{method,headers:{cookie:session,...(body?{'content-type':'application/json',...(origin?{origin}:{})}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 const worker=new BridgeWorker(db,async request=>`TEST DOUBLE result for ${request.agentId}/${request.sessionKey}`,createSoulManager(fixtures));
 await worker.start(randomUUID());
 const state=async()=>(await api('/api/hermes/bridge')).json();
 const boot=(await state()).bootId;assert.equal((await state()).enabled,false);
 const payload={agentId:'default',sessionKey:'thread-123',message:'Report current identity',mode:'chat',authorize:true,bootId:boot};
 assert.equal((await api('/api/hermes/dispatch',payload)).status,409);
 assert.equal((await api('/api/hermes/bridge',{enabled:true,bootId:boot,password:'wrong'})).status,403);
 for(const origin of [null,'https://evil.invalid'])assert.equal((await api('/api/hermes/bridge',{enabled:true,bootId:boot,password},'POST',origin)).status,403);
 assert.equal((await api('/api/hermes/bridge',{enabled:true,bootId:boot,password})).status,200);
 for(const changes of [{authorize:false},{agentId:'../../default'},{sessionKey:'../../state'},{history:[]},{message:'\u0000'},{inputMode:'audio-server'}])assert.equal((await api('/api/hermes/dispatch',{...payload,...changes})).status,400);
 for(const origin of [null,'https://evil.invalid'])assert.equal((await api('/api/hermes/dispatch',payload,'POST',origin)).status,403);
 const roster=await(await api('/api/agents')).json();assert.deepEqual(roster.map(a=>a.id),['default','yana','jenny','michael','michelle']);
 for(const agentId of roster.map(a=>a.id)){
  const response=await api('/api/hermes/dispatch',{...payload,agentId,inputMode:'voice',transcript:'initial dictation'});assert.equal(response.status,202);
  const {request}=await response.json();assert.equal(request.authorizedBy,'owner');assert.equal(request.decidedBy,'owner');assert.equal(request.sideEffecting,true);
  await worker.tick();
  const history=await(await api(`/api/hermes/requests?agentId=${agentId}&sessionKey=thread-123`)).json();assert.equal(history.requests.length,1);const saved=history.requests[0];assert.equal(saved.id,request.id);assert.equal(saved.status,'done');assert.match(saved.result,new RegExp(agentId));assert.equal(saved.inputMode,'voice');assert.equal(saved.transcript,'initial dictation');assert.ok(saved.startedAt&&saved.finishedAt);
 }
 const held=await(await api('/api/hermes/dispatch',{...payload,mode:'task'})).json();assert.equal(held.request.status,'awaiting_approval');assert.equal(await worker.claim(),null);
 const decision=(id,action,bootId=boot)=>api(`/api/hermes/requests/${id}`,{action,bootId},'PATCH');
 assert.equal((await decision(held.request.id,'approve','stale')).status,409);
 assert.equal((await decision(held.request.id,'approve')).status,200);
 const claims=await Promise.all(Array.from({length:20},()=>worker.claim()));assert.equal(claims.filter(Boolean).length,1);
 assert.equal((await decision(held.request.id,'reject')).status,409);
 const reject=await(await api('/api/hermes/dispatch',{...payload,mode:'task'})).json();assert.equal((await decision(reject.request.id,'reject')).status,200);assert.equal(await worker.claim(),null);
 const fail=await(await api('/api/hermes/dispatch',payload)).json();const failing=new BridgeWorker(db,async()=>{throw Error('Explicit test provider failure');});failing.bootId=boot;await failing.tick();assert.equal((await db.query('SELECT status,error FROM "AgentRequest" WHERE id=$1',[fail.request.id])).rows[0].error,'Explicit test provider failure');
 // Actual filesystem manager + production HTTP + isolated PostgreSQL, fixture roots only.
 const manage=(input,authorize=true)=>api('/api/hermes/management',{input,authorize,bootId:boot});
 assert.equal((await api('/api/hermes/management')).status,200);
 assert.equal((await api('/api/hermes/management',{input:{op:'soul.read',agentId:'default'},bootId:boot},'POST','https://evil.invalid')).status,403);
 for(const agentId of fixtures.map(p=>p.id)){
  const read=await(await manage({op:'soul.read',agentId})).json();assert.equal(read.request.status,'queued');await worker.tick();
  const observed=(await(await api(`/api/hermes/requests/${read.request.id}`)).json()).request;assert.equal(observed.status,'done');const actual=JSON.parse(observed.result);assert.equal(actual.content,`fixture actual ${agentId}`);
  const proposed={op:'soul.write',agentId,expectedVersion:actual.version,content:`edited ${agentId}`};
  assert.equal((await manage(proposed,false)).status,400);
  const heldSoul=(await(await manage(proposed)).json()).request;assert.equal(heldSoul.status,'awaiting_approval');assert.equal(await worker.claim(),null);
  assert.equal(await readFile(join(fixtures.find(p=>p.id===agentId).home,'SOUL.md'),'utf8'),actual.content);
  assert.equal((await decision(heldSoul.id,'approve','stale')).status,409);assert.equal((await decision(heldSoul.id,'approve')).status,200);
  await Promise.all([worker.tick(),worker.tick()]);const saved=(await(await api(`/api/hermes/requests/${heldSoul.id}`)).json()).request;assert.equal(saved.status,'done');const version=JSON.parse(saved.result);assert.equal(version.backupVersion,actual.version);
  assert.equal(await readFile(join(fixtures.find(p=>p.id===agentId).home,'SOUL.md'),'utf8'),`edited ${agentId}`);
  const stale=(await(await manage(proposed)).json()).request;await decision(stale.id,'approve');await worker.tick();assert.equal((await(await api(`/api/hermes/requests/${stale.id}`)).json()).request.status,'failed');
  const rollback=(await(await manage({op:'soul.rollback',agentId,expectedVersion:version.version,backupVersion:actual.version})).json()).request;await decision(rollback.id,'approve');await worker.tick();assert.equal((await(await api(`/api/hermes/requests/${rollback.id}`)).json()).request.status,'done');assert.equal(await readFile(join(fixtures.find(p=>p.id===agentId).home,'SOUL.md'),'utf8'),actual.content);
 }
 console.log('PASS actual SOUL read, explicit approval/write, stale checksum failure, backup and rollback for all 5 fixture profiles through production HTTP + isolated PostgreSQL; real profiles untouched.');
 await api('/api/hermes/bridge',{enabled:false,bootId:boot});assert.equal(await worker.claim(),null);assert.equal((await api('/api/hermes/dispatch',payload)).status,409);
 await worker.start(randomUUID());assert.equal((await state()).enabled,false);assert.equal((await api('/api/hermes/bridge',{enabled:true,bootId:boot,password})).status,409);
 console.log('PASS isolated PostgreSQL + production HTTP: owner auth; same-origin/fresh-password/current-boot gate; all five profile requests; voice transcript persistence; results/timestamps; approve/reject; provider error persistence; 20 atomic claims exactly once; OFF and restart/stale boot. Agent output explicitly test-double, not live inference.');
}finally{server.kill();await new Promise(r=>server.once('exit',r));await db.end();await rm(fixtureRoot,{recursive:true,force:true});}
