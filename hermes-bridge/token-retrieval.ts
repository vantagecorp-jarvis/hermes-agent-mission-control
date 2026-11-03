import {posix} from 'node:path';
export type RetrievalKind='kb'|'external'|'mixed'|'unknown';
// Deliberately conservative: structured tool invocations only. No prompt, response,
// shell-code or prose mining. A call is observed activity, not a successful answer.
export function classifyRetrieval(calls:Iterable<string|null>,cwd:string|null){
 let kb=0,external=0,incomplete=false,bytes=0,seen=0;
 function visit(name:unknown,args:unknown,depth=0){
  if(++seen>20000||depth>3){incomplete=true;return;}
  if(typeof name!=='string'||!args||typeof args!=='object')return;
  const a=args as Record<string,unknown>,n=name.replace(/^functions\./,'');
  if(n==='multi_tool_use.parallel'){
   if(Array.isArray(a.tool_uses)){if(a.tool_uses.length>100)incomplete=true;for(const t of a.tool_uses.slice(0,100)){visit(t?.recipient_name,t?.parameters,depth+1);}}else incomplete=true;return;
  }
  if(['read_file','search_files'].includes(n)&&typeof a.path==='string'){
   const path=posix.resolve(cwd?.startsWith('/')?cwd:'/',a.path);
   if(['/opt/data/brain/1-wiki','/opt/data/brain/0-raw'].some(root=>path===root||path.startsWith(root+'/')))kb++;
  }
  if(['web_search','web_extract'].includes(n))external++;
 }
 for(const raw of calls){
  if(!raw)continue;
  bytes+=raw.length;
  if(bytes>4000000||seen>20000){incomplete=true;break;}
  if(raw.length>65536){incomplete=true;continue;}
  try{
   const items=JSON.parse(raw);if(!Array.isArray(items)){incomplete=true;continue;}
   if(items.length>100)incomplete=true;
   for(const call of items.slice(0,100)){
    const fn=call?.function;
    if(fn)visit(fn.name,typeof fn.arguments==='string'?JSON.parse(fn.arguments):fn.arguments);
   }
  }catch{incomplete=true;}
 }
 const kind:RetrievalKind=kb&&external?'mixed':incomplete?'unknown':kb?'kb':external?'external':'unknown';
 return {kind,kbCalls:kb,externalCalls:external,incomplete};
}
