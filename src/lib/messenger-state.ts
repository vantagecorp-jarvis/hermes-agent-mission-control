import {conversationHistory} from './chat-history';
export type ConversationTab={key:string;agentId:string};
export type Workspace={tabs:ConversationTab[];activeKey:string};
export type Shortcut={id:string;label:string;agentId:string;prompt:string;mode:'chat'|'task'};
export function restoreWorkspace(raw:string|null):Workspace|null{
 try{const s=JSON.parse(raw||'null');if(!s||!Array.isArray(s.tabs)||!s.tabs.length||s.tabs.some((t:ConversationTab)=>!t||typeof t.key!=='string'||!t.key||typeof t.agentId!=='string'||!t.agentId)||!s.tabs.some((t:ConversationTab)=>t.key===s.activeKey))return null;return {tabs:s.tabs,activeKey:s.activeKey};}catch{return null;}
}
export function openConversation(state:Workspace,tab:ConversationTab):Workspace{
 return {tabs:state.tabs.some(t=>t.key===tab.key&&t.agentId===tab.agentId)?state.tabs:[...state.tabs,tab],activeKey:tab.key};
}
export function closeConversation(state:Workspace,key:string,fallback:ConversationTab):Workspace{
 const index=state.tabs.findIndex(t=>t.key===key);
 if(index<0)return state;
 const tabs=state.tabs.filter(t=>t.key!==key);
 if(!tabs.length)return {tabs:[fallback],activeKey:fallback.key};
 return {tabs,activeKey:state.activeKey===key?tabs[Math.min(index,tabs.length-1)].key:state.activeKey};
}
export function readShortcuts(raw:string|null):Shortcut[]|null{
 try{const s=JSON.parse(raw||'null');if(!Array.isArray(s)||s.some(t=>!t||!['id','label','agentId','prompt'].every(k=>typeof t[k]==='string'&&t[k].trim())||!['chat','task'].includes(t.mode)))return null;return s;}catch{return null;}
}
export function searchHistory(rows:{agentId:string;sessionKey:string;prompt:string;createdAt:string}[],agentId:string,query:string){
 const q=query.trim().toLocaleLowerCase();const keys=new Set(rows.filter(r=>r.agentId===agentId&&r.prompt.toLocaleLowerCase().includes(q)).map(r=>r.sessionKey));
 return conversationHistory(rows,agentId).filter(t=>!q||keys.has(t.key));
}
