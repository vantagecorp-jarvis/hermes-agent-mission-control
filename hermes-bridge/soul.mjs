import {constants} from 'node:fs';
import {open,realpath,lstat,mkdir,rename,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {registeredProfiles} from './profiles.mjs';
import {validateSoulInput} from './soul-policy.mjs';
export {validateSoulInput,soulOps} from './soul-policy.mjs';
export const checksum = value => createHash('sha256').update(value).digest('hex');
async function boundedRead(path) {
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const stat=await f.stat();if(!stat.isFile() || stat.size>65536 || stat.nlink!==1)throw Error('SOUL source must be a bounded regular unlinked file');const bytes=await f.readFile();if(bytes.length>65536)throw Error('SOUL source too large');return {bytes,version:checksum(bytes),mode:stat.mode&0o777};}finally{await f.close();}
}
// Root injection is an internal module seam for fixture tests, never an API/env parameter.
export function createSoulManager(profiles=registeredProfiles) {
 return async function manage(input,context) {
  const b=validateSoulInput(input), profile=profiles.find(p=>p.id===b.agentId);
  if(!profile)throw Error('Unregistered SOUL root');
  if(await realpath(profile.home)!==profile.home)throw Error('Symlinked profile roots are not supported');
  const path=join(profile.home,'SOUL.md');
  if(b.op!=='soul.read') {
   if(context?.owner!=='owner'||context.approved!==true||typeof context.requestId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(context.requestId))throw Error('Explicit owner approval required');
   const dir=join(profile.home,'.mission-control-soul');await mkdir(dir,{mode:0o700}).catch(e=>{if(e.code!=='EEXIST')throw e;});
   if(!(await lstat(dir)).isDirectory() || await realpath(dir)!==dir)throw Error('Unsafe backup directory');
   const lockPath=join(dir,'write.lock'), lock=await open(lockPath,'wx',0o600);let temp;
   try {
    const current=await boundedRead(path);if(current.version!==b.expectedVersion)throw Error('Version conflict: reload actual SOUL before saving');
    let next=Buffer.from(b.content||'','utf8');
    if(b.op==='soul.rollback'){const backup=await boundedRead(join(dir,`${b.backupVersion}.md`));if(backup.version!==b.backupVersion)throw Error('Backup checksum mismatch');next=backup.bytes;}
    const version=checksum(next),backupPath=join(dir,`${current.version}.md`);
    try{const backup=await open(backupPath,'wx',0o600);try{await backup.writeFile(current.bytes);await backup.sync();}finally{await backup.close();}}catch(e){if(e.code!=='EEXIST')throw e;if((await boundedRead(backupPath)).version!==current.version)throw Error('Unsafe or corrupt existing backup');}
    const audit=await open(join(dir,'audit.jsonl'),constants.O_WRONLY|constants.O_APPEND|constants.O_CREAT|constants.O_NOFOLLOW,0o600);
    try {
     const entry={owner:'owner',requestId:context.requestId,agentId:b.agentId,op:b.op,before:current.version,after:version,time:new Date().toISOString()};
     await audit.writeFile(JSON.stringify({...entry,phase:'intent'})+'\n');await audit.sync();
     temp=join(profile.home,`.SOUL-${context.requestId}.tmp`);const f=await open(temp,'wx',current.mode);try{await f.writeFile(next);await f.sync();}finally{await f.close();}
     if((await boundedRead(path)).version!==current.version)throw Error('Version conflict: SOUL changed during save');
     await rename(temp,path);temp=null;const directory=await open(profile.home,'r');try{await directory.sync();}finally{await directory.close();}
     const actual=await boundedRead(path);if(actual.version!==version)throw Error('SOUL changed after save; inspect backup before retry');
     await audit.writeFile(JSON.stringify({...entry,phase:'committed'})+'\n');await audit.sync();
     return {agentId:b.agentId,version:actual.version,backupVersion:current.version,owner:'owner',requestId:context.requestId,saved:true};
    }finally{await audit.close();}
   }finally{if(temp)await unlink(temp).catch(()=>{});await lock.close();await unlink(lockPath);}
  }
  try{const r=await boundedRead(path);return {agentId:b.agentId,name:profile.name,profile:profile.home,source:'SOUL.md',content:new TextDecoder('utf-8',{fatal:true}).decode(r.bytes),version:r.version};}
  catch{throw Error('Actual SOUL.md unavailable, unsafe or invalid UTF-8; no synthesized fallback');}
 };
}
export const manageSoul = createSoulManager();
