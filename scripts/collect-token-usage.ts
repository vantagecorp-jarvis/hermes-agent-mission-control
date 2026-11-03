#!/usr/bin/env -S node --import tsx
import {parseArgs} from 'node:util';
import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import pg from 'pg';
import {collectTokens} from '../hermes-bridge/token-collector';
import {ingestTokens} from '../hermes-bridge/token-store';
import {databaseOptions} from '../hermes-bridge/core.mjs';
import {summarizeUsage} from '../src/lib/token-usage';
async function main(){
 const {values}=parseArgs({options:{help:{type:'boolean'},upload:{type:'boolean'},output:{type:'string'},'bridge-env':{type:'string'}}});
 if(values.help){console.log('Deterministic read-only Hermes token collector. No model calls.\nnode --import tsx scripts/collect-token-usage.ts [--output /private/snapshot.json] [--upload --bridge-env /private/bridge-runtime.json]\nDefault: collect and print aggregate coverage only. --upload replaces and verifies one DataStore key.');return;}
 let output:string|undefined;
 if(values.output){output=resolve(values.output);const rel=relative(resolve(__dirname,'..'),output);if(!rel.startsWith('..'))throw Error('Snapshot output must be outside repository');}
 let options;
 if(values.upload){
  const env=values['bridge-env']?JSON.parse(readFileSync(values['bridge-env'],'utf8')):process.env;
  options=databaseOptions(env.DATABASE_URL,env.BRIDGE_DB_TRANSPORT);
 }
 const snapshot=collectTokens();
 if(output){const temp=output+'.tmp';writeFileSync(temp,JSON.stringify(snapshot),{mode:0o600});renameSync(temp,output);}
 if(options){const pool=new pg.Pool({...options,connectionTimeoutMillis:5000,statement_timeout:15000});try{await ingestTokens(pool,snapshot);}finally{await pool.end();}}
 const {totals}=summarizeUsage(snapshot.rows,'daily');
 console.log(JSON.stringify({mode:values.upload?'uploaded-and-verified':'dry-run',collectedAt:snapshot.collectedAt,sources:snapshot.sources,dayAgentBuckets:snapshot.rows.length,sessions:totals.sessions,auxiliaryRecords:totals.auxiliaryRecords,metrics:totals.metrics,retrieval:totals.retrieval,incompleteSessions:totals.incompleteSessions}));
 if(snapshot.sources.some(s=>s.status==='unavailable'))process.exitCode=2;
}
main().catch(()=>{console.error('Token collection/import failed. Check arguments, read access and private database transport; no credentials or source content logged.');process.exitCode=1;});
