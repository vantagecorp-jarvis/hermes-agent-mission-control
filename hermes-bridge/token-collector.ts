import Database from 'better-sqlite3';
import {registeredProfiles} from './profiles.mjs';
import {classifyRetrieval} from './token-retrieval';
import {dayFor,emptyMetrics,mergeMetrics,metricsFor,type Counters,type SourceCoverage,type TokenSnapshot,type UsageRow} from '../src/lib/token-usage';
type Profile={id:string;name:string;home:string};
type Session=Counters&{id:string;started_at:number;ended_at:number|null;last_activity_at:number|null;cwd:string|null};
const columns='input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,reasoning_tokens,actual_cost_usd,estimated_cost_usd,cost_status,billing_mode';
export function collectTokens(profiles:readonly Profile[]=registeredProfiles,collectedAt=new Date().toISOString()):TokenSnapshot {
 const sources:SourceCoverage[]=[],rows:UsageRow[]=[];
 for(const p of profiles){
  const coverage:SourceCoverage={agentId:p.id,name:p.name,status:'unavailable',sessions:0,activeSessions:0,undatedSessions:0,firstDay:null,lastDay:null,lastActivity:null,error:null};
  let db:Database.Database|undefined;
  try{
   db=new Database(`${p.home}/state.db`,{readonly:true,fileMustExist:true,timeout:3000});
   db.pragma('query_only = ON');db.exec('BEGIN');
   const sessions=db.prepare(`SELECT id,started_at,ended_at,last_activity_at,cwd,${columns} FROM sessions ORDER BY started_at,id`).all() as Session[];
   const calls=db.prepare(`SELECT substr(tool_calls,1,65537) AS tool_calls FROM messages WHERE session_id=? AND role='assistant' AND tool_calls IS NOT NULL ORDER BY rowid LIMIT 20001`);
   const aux=db.prepare(`SELECT ${columns} FROM session_model_usage WHERE session_id=? AND task<>''`);
   const daily=new Map<string,UsageRow>();let latest=0;
   for(const s of sessions){
    coverage.sessions++;if(s.ended_at===null)coverage.activeSessions++;
    const activity=s.last_activity_at||s.started_at;if(Number.isFinite(activity))latest=Math.max(latest,activity);
    if(!Number.isFinite(s.started_at)||s.started_at<=0){coverage.undatedSessions++;continue;}
    const day=dayFor(s.started_at);
    coverage.firstDay=coverage.firstDay&&coverage.firstDay<day?coverage.firstDay:day;
    coverage.lastDay=coverage.lastDay&&coverage.lastDay>day?coverage.lastDay:day;
    const row=daily.get(day)||{day,agentId:p.id,sessions:0,auxiliaryRecords:0,metrics:emptyMetrics(),retrieval:{kb:0,external:0,mixed:0,unknown:0},kbCalls:0,externalCalls:0,incompleteSessions:0};
    row.sessions++;row.metrics=mergeMetrics(row.metrics,metricsFor(s));
    for(const a of aux.all(s.id) as Counters[]){
     // Auxiliary cost columns default to zero. Positive recorded amounts prove
     // availability even when this Hermes writer omitted cost_status; ambiguous
     // default zeros remain null unless status explicitly confirms them.
     const actual=a.cost_status==='actual'||(a.actual_cost_usd||0)>0?a.actual_cost_usd:null;
     const estimated=a.cost_status==='estimated'||(a.estimated_cost_usd||0)>0?a.estimated_cost_usd:null;
     row.metrics=mergeMetrics(row.metrics,metricsFor({...a,actual_cost_usd:actual,estimated_cost_usd:estimated}));row.auxiliaryRecords++;
    }
    function* evidenceRows(){let count=0;for(const record of calls.iterate(s.id) as Iterable<{tool_calls:string}>){if(++count>20000){yield '{';break;}yield record.tool_calls;}}
    const evidence=classifyRetrieval(evidenceRows(),s.cwd);
    row.retrieval[evidence.kind]++;row.kbCalls+=evidence.kbCalls;row.externalCalls+=evidence.externalCalls;if(evidence.incomplete)row.incompleteSessions++;
    daily.set(day,row);
   }
   coverage.lastActivity=latest?new Date(latest*1000).toISOString():null;
   coverage.status=sessions.length?'ready':'empty';rows.push(...daily.values());
   db.exec('ROLLBACK');
  }catch{
   Object.assign(coverage,{status:'unavailable',sessions:0,activeSessions:0,undatedSessions:0,firstDay:null,lastDay:null,lastActivity:null,error:'Session store unavailable or schema unsupported'});
  }finally{db?.close();}
  sources.push(coverage);
 }
 return {version:1,collectedAt,timezone:'Europe/Warsaw',attribution:'session-start',sources,rows:rows.sort((a,b)=>a.day.localeCompare(b.day)||a.agentId.localeCompare(b.agentId))};
}
