export type Period = 'daily'|'weekly'|'monthly';
export function dayFor(seconds:number):string {
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(seconds*1000));
}
export function periodFor(day:string,period:Period):string {
 if(period==='monthly')return day.slice(0,7)+'-01';
 if(period==='daily')return day;
 const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);
}
export type Counters = {input_tokens?:number|null;output_tokens?:number|null;cache_read_tokens?:number|null;cache_write_tokens?:number|null;reasoning_tokens?:number|null;actual_cost_usd?:number|null;estimated_cost_usd?:number|null;cost_status?:string|null;billing_mode?:string|null};
export type Metrics = {input:number;output:number;cacheRead:number;cacheWrite:number;reasoning:number;total:number;actualUsd:number|null;estimatedUsd:number|null;missingCost:number;includedCost:number;actualCount:number;estimatedCount:number};
export type UsageRow={day:string;agentId:string;sessions:number;auxiliaryRecords:number;metrics:Metrics;retrieval:{kb:number;external:number;mixed:number;unknown:number};kbCalls:number;externalCalls:number;incompleteSessions:number};
export type SourceCoverage={agentId:string;name:string;status:'ready'|'empty'|'unavailable';sessions:number;activeSessions:number;undatedSessions:number;firstDay:string|null;lastDay:string|null;lastActivity:string|null;error:string|null};
export type TokenSnapshot={version:1;collectedAt:string;timezone:'Europe/Warsaw';attribution:'session-start';sources:SourceCoverage[];rows:UsageRow[]};
export function mergeMetrics(a:Metrics,b:Metrics):Metrics {
 const result={...a};for(const key of Object.keys(a) as (keyof Metrics)[]){
  if(key==='actualUsd'||key==='estimatedUsd')result[key]=a[key]===null&&b[key]===null?null:(a[key]||0)+(b[key]||0);
  else result[key]=a[key]+b[key];
 }return result;
}
export function emptyMetrics():Metrics{return {...metricsFor({}),missingCost:0};}
export function blankRow(day:string,agentId:string):UsageRow{return {day,agentId,sessions:0,auxiliaryRecords:0,metrics:emptyMetrics(),retrieval:{kb:0,external:0,mixed:0,unknown:0},kbCalls:0,externalCalls:0,incompleteSessions:0};}
export function addRow(a:UsageRow,b:UsageRow):UsageRow{
 return {...a,sessions:a.sessions+b.sessions,auxiliaryRecords:a.auxiliaryRecords+b.auxiliaryRecords,metrics:mergeMetrics(a.metrics,b.metrics),retrieval:{kb:a.retrieval.kb+b.retrieval.kb,external:a.retrieval.external+b.retrieval.external,mixed:a.retrieval.mixed+b.retrieval.mixed,unknown:a.retrieval.unknown+b.retrieval.unknown},kbCalls:a.kbCalls+b.kbCalls,externalCalls:a.externalCalls+b.externalCalls,incompleteSessions:a.incompleteSessions+b.incompleteSessions};
}
export function summarizeUsage(input:UsageRow[],period:Period,agent='all',from='',to=''){
 const buckets=new Map<string,UsageRow>();let totals=blankRow('','all');
 for(const row of input){
  if((agent!=='all'&&row.agentId!==agent)||(from&&row.day<from)||(to&&row.day>to))continue;
  const day=periodFor(row.day,period),key=day+'|'+row.agentId;
  buckets.set(key,addRow(buckets.get(key)||blankRow(day,row.agentId),row));totals=addRow(totals,row);
 }
 const known=totals.retrieval.kb+totals.retrieval.external+totals.retrieval.mixed;
 return {rows:[...buckets.values()].sort((a,b)=>b.day.localeCompare(a.day)||a.agentId.localeCompare(b.agentId)),totals,kbOnlyPercent:known?100*totals.retrieval.kb/known:null};
}
export function metricsFor(r:Counters):Metrics {
 const input=r.input_tokens||0,output=r.output_tokens||0,cacheRead=r.cache_read_tokens||0,cacheWrite=r.cache_write_tokens||0;
 const included=r.cost_status==='included'||r.billing_mode==='subscription_included';
 const actualUsd=!included&&r.actual_cost_usd!=null?r.actual_cost_usd:null;
 const estimatedUsd=!included&&r.estimated_cost_usd!=null?r.estimated_cost_usd:null;
 return {input,output,cacheRead,cacheWrite,reasoning:r.reasoning_tokens||0,total:input+output+cacheRead+cacheWrite,actualUsd,estimatedUsd,missingCost:!included&&actualUsd===null&&estimatedUsd===null?1:0,includedCost:included?1:0,actualCount:actualUsd===null?0:1,estimatedCount:estimatedUsd===null?0:1};
}
