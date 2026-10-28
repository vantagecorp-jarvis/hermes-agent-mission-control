import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createSoulManager} from '../hermes-bridge/soul.mjs';
test('reads actual distinct SOUL files for all five fixture profiles, never synthesized',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mc-soul-'));
 try{const profiles=await Promise.all(['default','yana','jenny','michael','michelle'].map(async id=>{const home=join(root,id);await import('node:fs/promises').then(fs=>fs.mkdir(home));await writeFile(join(home,'SOUL.md'),`real ${id}\n`);return {id,home,name:id};}));
 const manager=createSoulManager(profiles);for(const p of profiles){const r=await manager({op:'soul.read',agentId:p.id});assert.equal(r.content,`real ${p.id}\n`);assert.match(r.version,/^[a-f0-9]{64}$/);}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('owner-approved write backs up atomically, rejects stale versions and supports checksum rollback',async()=>{
 const home=await mkdtemp(join(tmpdir(),'mc-edit-'));const manager=createSoulManager([{id:'default',name:'MIA',home}]);
 try{await writeFile(join(home,'SOUL.md'),'old soul');const old=await manager({op:'soul.read',agentId:'default'});
 await assert.rejects(()=>manager({op:'soul.write',agentId:'default',content:'new soul',expectedVersion:old.version}));
 const context={owner:'owner',requestId:'fixture-request',approved:true};
 const saved=await manager({op:'soul.write',agentId:'default',content:'new soul',expectedVersion:old.version},context);
 assert.equal(await readFile(join(home,'SOUL.md'),'utf8'),'new soul');assert.equal(saved.backupVersion,old.version);
 await assert.rejects(()=>manager({op:'soul.write',agentId:'default',content:'stale',expectedVersion:old.version},context),/conflict/);
 const restored=await manager({op:'soul.rollback',agentId:'default',expectedVersion:saved.version,backupVersion:old.version},context);
 assert.equal(restored.version,old.version);assert.equal(await readFile(join(home,'SOUL.md'),'utf8'),'old soul');
 const log=await readFile(join(home,'.mission-control-soul','audit.jsonl'),'utf8');assert.match(log, /"owner":"owner"/);assert.ok(!log.includes('old soul')&&!log.includes('new soul'));
 }finally{await rm(home,{recursive:true,force:true});}
});
test('path overrides, traversal, symlink SOUL and backup directories fail closed',async()=>{
 const home=await mkdtemp(join(tmpdir(),'mc-unsafe-'));const manager=createSoulManager([{id:'default',name:'MIA',home}]);
 try{await writeFile(join(home,'other'),'secret');await symlink(join(home,'other'),join(home,'SOUL.md'));
 await assert.rejects(()=>manager({op:'soul.read',agentId:'default'}));await assert.rejects(()=>manager({op:'soul.read',agentId:'../../default'}));await assert.rejects(()=>manager({op:'soul.read',agentId:'default',path:'other'}));
 await rm(join(home,'SOUL.md'));await writeFile(join(home,'SOUL.md'),'safe');const old=await manager({op:'soul.read',agentId:'default'});await mkdir(join(home,'elsewhere'));await symlink(join(home,'elsewhere'),join(home,'.mission-control-soul'));
 await assert.rejects(()=>manager({op:'soul.write',agentId:'default',content:'bad',expectedVersion:old.version},{owner:'owner',requestId:'fixture',approved:true}));assert.equal(await readFile(join(home,'SOUL.md'),'utf8'),'safe');
 }finally{await rm(home,{recursive:true,force:true});}
});
