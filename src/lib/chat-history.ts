type HistoryRow={agentId:string;sessionKey:string;prompt:string;createdAt:string};
export function threadMessages<T extends HistoryRow>(rows:T[],agentId:string,key:string):T[]{
 return rows.filter(r=>r.agentId===agentId&&r.sessionKey===key).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}
export function conversationHistory(rows:HistoryRow[],agentId:string){
 const threads=new Map<string,{key:string;title:string;updatedAt:string}>();
 for(const row of rows.filter(r=>r.agentId===agentId&&r.sessionKey).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))){
  const previous=threads.get(row.sessionKey);
  threads.set(row.sessionKey,{key:row.sessionKey,title:previous?.title||row.prompt.replace(/\s+/g,' ').slice(0,64)||'Untitled conversation',updatedAt:row.createdAt});
 }
 return [...threads.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}
