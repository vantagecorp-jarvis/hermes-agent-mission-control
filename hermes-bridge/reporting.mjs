import {readFile,stat} from 'node:fs/promises';
import {registeredProfiles} from './profiles.mjs';
// Read only explicit non-secret fields. Never mirror prompts, scripts, .env, auth/config.
export async function profileSnapshot(){
 const result={};
 for(const p of registeredProfiles){
  const row={observedAt:new Date().toISOString(),crons:null,sessionStorePresent:false,error:null};
  try{row.sessionStorePresent=(await stat(`${p.home}/state.db`)).isFile();}catch{}
  try{const path=`${p.home}/cron/jobs.json`;const info=await stat(path);if(info.size>2000000)throw Error('oversize');const data=JSON.parse(await readFile(path,'utf8'));const jobs=Array.isArray(data)?data:data.jobs;if(!Array.isArray(jobs))throw Error('shape');row.crons=jobs.map(j=>({id:j.id,name:j.name||j.id,enabled:j.enabled,state:j.state,schedule:j.schedule_display||null,nextRun:j.next_run_at||null,lastRun:j.last_run_at||null}));}
  catch(error){row.error=error.code==='ENOENT'?'No local cron registry':'Cron source unavailable/unreadable';}
  result[p.id]=row;
 }
 return result;
}
