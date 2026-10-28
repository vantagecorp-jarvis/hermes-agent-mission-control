"use client";
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Menu,Plus,ArrowUp,SlidersHorizontal,X,ChevronDown} from 'lucide-react';
import {BridgeControl} from './bridge-control';
import {VoiceDictation} from './voice-dictation';
import {conversationHistory,threadMessages} from '@/lib/chat-history';
import {openConversation,closeConversation,restoreWorkspace,readShortcuts,searchHistory,type Workspace,type Shortcut} from '@/lib/messenger-state';
type Agent={id:string;name:string;status:string;tasksCompleted:number;crons?:unknown[];observedAt?:string;error?:string};
type Row={kind?:string;inputMode?:string;transcript?:string;id:string;agentId:string;sessionKey:string;prompt:string;status:string;result?:string;error?:string;createdAt:string;authorizedAt?:string;decidedAt?:string};
export function BridgeStatus(){
 const [label,setLabel]=useState('Bridge UNKNOWN');
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/hermes/bridge',{cache:'no-store'});if(!r.ok)throw Error();const b=await r.json();if(active)setLabel(b.online?b.enabled?'Bridge ON':'Bridge OFF':'Bridge OFFLINE');}catch{if(active)setLabel('Bridge UNKNOWN');}};load();const t=setInterval(load,3000);return()=>{active=false;clearInterval(t);};},[]);
 return <span role="status">{label}</span>;
}
// Native modal supplies focus trapping, Escape, and restores the trigger focus.
function Panel({title,side,close,children}:{title:string;side?:boolean;close:()=>void;children:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
 return <dialog ref={ref} className={side?'mc-dialog mc-drawer':'mc-dialog'} onCancel={close} onClick={e=>{if(e.target===e.currentTarget)close();}} aria-label={title}><header><h2>{title}</h2><button aria-label="Close panel" onClick={close}><X size={20}/></button></header><div className="mc-panel-content">{children}</div></dialog>;
}
export function MissionControl({initialPanel=''}:{initialPanel?:''|'tasks'}={}){
 const [agents,setAgents]=useState<Agent[]>([]),[agentId,setAgentId]=useState('default'),[sessionKey,setSessionKey]=useState(''),[rows,setRows]=useState<Row[]>([]),[pending,setPending]=useState<Row[]>([]),[taskRows,setTaskRows]=useState<Row[]>([]);
 const [inputMode,setInputMode]=useState('text'),[transcript,setTranscript]=useState('');
 const [bridge,setBridge]=useState<{enabled:boolean;online:boolean;bootId:string}|null>(null),[message,setMessage]=useState(''),[mode,setMode]=useState('chat'),[authorize,setAuthorize]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 const [panel,setPanel]=useState<''|'menu'|'approvals'|'bridge'|'sources'|'shortcuts'|'tasks'>(initialPanel),[loaded,setLoaded]=useState(false);
 const [workspace,setWorkspace]=useState<Workspace>({tabs:[],activeKey:''}),[storageReady,setStorageReady]=useState(false),[shortcuts,setShortcuts]=useState<Shortcut[]>([]),[search,setSearch]=useState('');
 const [shortcutDraft,setShortcutDraft]=useState<Shortcut|null>(null);
 const currentAgent=useRef(agentId),scrollRef=useRef<HTMLDivElement>(null),follow=useRef(true);
 currentAgent.current=agentId;
 function clearDraft(){setMessage('');setAuthorize(false);setInputMode('text');setTranscript('');}
 function selectThread(key:string,recipient=agentId){
  setWorkspace(s=>openConversation(s,{key,agentId:recipient}));setAgentId(recipient);setSessionKey(key);clearDraft();follow.current=true;
 }
 function newConversation(){selectThread(crypto.randomUUID(),'default');setPanel('');}
 function closeTab(key:string){
  if(busy)return;
  const next=closeConversation(workspace,key,{key:crypto.randomUUID(),agentId:'default'});
  setWorkspace(next);
  if(sessionKey===key){const tab=next.tabs.find(t=>t.key===next.activeKey)!;setAgentId(tab.agentId);setSessionKey(tab.key);clearDraft();follow.current=true;}
 }
 function selectAgent(recipient:string){
  const previous=[...workspace.tabs].reverse().find(t=>t.agentId===recipient);
  selectThread(previous?.key||crypto.randomUUID(),recipient);
 }
 function applyShortcut(shortcut:Shortcut){
  if(!agents.some(a=>a.id===shortcut.agentId)){setNote('This shortcut’s agent is unavailable. Edit the shortcut to choose a registered agent.');return;}
  if(shortcut.agentId!==agentId)selectAgent(shortcut.agentId);
  setMessage(shortcut.prompt);setMode(shortcut.mode);setAuthorize(false);setInputMode('text');setTranscript('');
 }
 useEffect(()=>{
  let saved:Workspace|null=null;let chips:Shortcut[]|null=null;
  try{saved=restoreWorkspace(localStorage.getItem('mc-workspace-v1'));chips=readShortcuts(localStorage.getItem('mc-shortcuts-v1'));}catch{setNote('Browser storage unavailable. Conversations remain server-side; tabs and shortcuts will not persist.');}
  const tab=saved?.tabs.find(t=>t.key===saved.activeKey)||{key:crypto.randomUUID(),agentId:'default'};
  setWorkspace(saved||{tabs:[tab],activeKey:tab.key});setAgentId(tab.agentId);setSessionKey(tab.key);
  setShortcuts(chips??[
   {id:'plan',label:'Plan my day',agentId:'default',prompt:'Help me plan my day. Review priorities and suggest a realistic next step.',mode:'chat'},
   {id:'review',label:'Review a draft',agentId:'default',prompt:'Help me review a draft. Ask me for the text and the intended audience first.',mode:'chat'},
   {id:'task',label:'Prepare a task',agentId:'default',prompt:'Review my current priorities and propose a task plan. Do not send messages or publish anything.',mode:'task'}
  ]);setStorageReady(true);
 },[]);
 useEffect(()=>{if(!storageReady)return;try{localStorage.setItem('mc-workspace-v1',JSON.stringify(workspace));localStorage.setItem('mc-shortcuts-v1',JSON.stringify(shortcuts));}catch{setNote('Could not save browser preferences. Your server-side history is unchanged.');}},[workspace,shortcuts,storageReady]);
 useEffect(()=>{setRows([]);setLoaded(false);follow.current=true;},[agentId]);
 const refresh=useCallback(async()=>{const recipient=agentId;try{
  const responses=await Promise.all([fetch('/api/agents',{cache:'no-store'}),fetch('/api/hermes/bridge',{cache:'no-store'}),fetch(`/api/hermes/requests?agentId=${encodeURIComponent(agentId)}&take=200`,{cache:'no-store'}),fetch('/api/hermes/requests?status=awaiting_approval&take=200',{cache:'no-store'}),fetch('/api/hermes/requests?take=200',{cache:'no-store'})]);
  if(responses.some(r=>!r.ok))throw Error('Could not refresh live state. Your draft is kept; try again.');
  const [a,b,r,p,all]=await Promise.all(responses.map(r=>r.json()));if(currentAgent.current!==recipient)return;setAgents(a);setBridge(b);setRows(r.requests);setPending(p.requests);setTaskRows(all.requests);setLoaded(true);
 }catch(e){if(currentAgent.current===recipient){setBridge(null);setNote((e as Error).message);}}},[agentId]);
 useEffect(()=>{refresh();const t=setInterval(refresh,2500);return()=>clearInterval(t);},[refresh]);
 useEffect(()=>{const el=scrollRef.current;if(el&&follow.current)el.scrollTop=el.scrollHeight;},[rows,sessionKey]);
 async function post(url:string,body:object,method='POST'){
  setBusy(true);setNote('');try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw Error(b.error||'Request failed');return true;}catch(e){setNote((e as Error).message);return false;}finally{setBusy(false);await refresh();}
 }
 async function send(){if(!ready||busy||!authorize||!message.trim()||!sessionKey)return;follow.current=true;if(await post('/api/hermes/dispatch',{agentId,sessionKey,message,mode,authorize,bootId:bridge?.bootId,inputMode,transcript}))clearDraft();}
 const ready=!!bridge?.online&&bridge.enabled;
 const active=agents.find(a=>a.id===agentId),name=active?.name||(agentId==='default'?'MIA':agentId.toUpperCase());
 const history=conversationHistory(rows,agentId),filteredHistory=searchHistory(rows,agentId,search),messages=threadMessages(rows,agentId,sessionKey);
 const title=history.find(t=>t.key===sessionKey)?.title||'New conversation';
 const bridgeLabel=bridge?.online?bridge.enabled?'Bridge ON':'Bridge OFF':bridge?'Bridge OFFLINE':'Bridge UNKNOWN';
 return <main className="mc-app">
  <header className="mc-header"><button className="mc-icon" aria-label="Open menu and history" onClick={()=>setPanel('menu')}><Menu size={21}/></button><Link href="/" className="mc-brand">Mission Control<span className="mc-brand-dot">.</span></Link><span className="mc-header-recipient">{name}</span><div className="mc-header-actions"><button className={`mc-bridge ${ready?'is-ready':''}`} onClick={()=>setPanel('bridge')} title="Bridge controls"><span/>{bridgeLabel}</button><button className="mc-icon" aria-label="New conversation" disabled={busy} onClick={newConversation}><Plus size={22}/></button></div></header>
  <nav className="mc-tabs" aria-label="Open conversations">{workspace.tabs.map((tab,index)=><div className="mc-tab-item" key={tab.key}><button aria-current={sessionKey===tab.key?'page':undefined} disabled={busy} onClick={()=>selectThread(tab.key,tab.agentId)}>{agents.find(a=>a.id===tab.agentId)?.name||tab.agentId.toUpperCase()} · {tab.agentId===agentId?history.find(t=>t.key===tab.key)?.title||`Chat ${index+1}`:`Chat ${index+1}`}</button><button className="mc-tab-close" aria-label={`Close ${agents.find(a=>a.id===tab.agentId)?.name||tab.agentId} conversation tab ${index+1}`} title="Close tab — history is kept" disabled={busy} onClick={()=>closeTab(tab.key)}><X size={14}/></button></div>)}<button aria-label="Add conversation tab" disabled={busy} onClick={newConversation}><Plus size={16}/></button></nav>
  <div className="mc-thread-label"><span>{title}</span><button onClick={()=>setPanel('approvals')}><SlidersHorizontal size={15}/> Approvals{pending.length>0&&<b>{pending.length}</b>}</button></div>
  <div className="mc-conversation" ref={scrollRef} onScroll={()=>{const el=scrollRef.current;if(el)follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<100;}} role="region" aria-label={`Conversation with ${name}`} tabIndex={0}>
   {!messages.length?<div className="mc-empty"><div className="mc-monogram" aria-hidden="true">mc<span>.</span></div><h1>{loaded?'What’s on your mind?':'Your conversation starts here.'}</h1><p>{agentId==='default'?'Start with MIA. Your coordinator delegates and tracks the work.':`Direct conversation with ${name}. MIA remains your primary coordinator.`}</p></div>:<div className="mc-messages">{messages.map(r=><article className="mc-exchange" key={r.id}><div className="mc-owner"><span>You</span><p>{r.prompt}</p></div><div className="mc-reply"><strong>{name}</strong>{r.result&&<div className="mc-result">{r.result}</div>}{r.error&&<p role="alert" className="mc-error">{r.error}</p>}{!r.result&&!r.error&&<p className="mc-pending" role="status">{r.status==='awaiting_approval'?'Waiting for your approval.':r.status==='running'?'Request running. After a bridge interruption, inspect the outcome before retrying.':`Request ${r.status}.`}</p>}<details className="mc-request-details"><summary>{r.status.replaceAll('_',' ')} · {new Date(r.createdAt).toLocaleString()}</summary><p>Request {r.id}<br/>Authorized: {r.authorizedAt||'none'}<br/>Decision: {r.decidedAt||'pending'}</p>{r.transcript&&<p>Original voice transcript: {r.transcript}</p>}</details></div></article>)}</div>}
  </div>
  <div className="mc-compose-dock">
   {note&&<div className="mc-notice" role="alert">{note}<button aria-label="Dismiss notice" onClick={()=>setNote('')}><X size={16}/></button></div>}
   <div className="mc-shortcuts" aria-label="Quick tasks">{shortcuts.map(s=><button disabled={busy} key={s.id} onClick={()=>applyShortcut(s)} title={`Prefill for ${agents.find(a=>a.id===s.agentId)?.name||s.agentId} · review before sending`}>{s.label}</button>)}<button aria-label="Customize quick tasks" onClick={()=>{setShortcutDraft(null);setPanel('shortcuts');}}><SlidersHorizontal size={16}/> Customize</button></div>
   <section className="mc-composer" aria-label="Message composer">
    <div className="mc-recipient-row"><label className="mc-recipient">To: <select aria-label="Recipient" value={agentId} disabled={busy} onChange={e=>selectAgent(e.target.value)}>{(agents.length?agents:[{id:'default',name:'MIA'}]).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select><ChevronDown size={14}/></label><label className="mc-mode"><select aria-label="Request mode" value={mode} disabled={busy} onChange={e=>{setMode(e.target.value);setAuthorize(false);}}><option value="chat">Chat</option><option value="task">Task · approval required</option></select></label></div>
    <textarea aria-label="Agent message or task" disabled={busy} value={message} onChange={e=>{setMessage(e.target.value);setAuthorize(false);}} maxLength={24000} rows={2} placeholder={`Message ${name}…`}/>
    <div className="mc-composer-bottom"><VoiceDictation key={agentId+sessionKey} disabled={busy} compact onTranscript={text=>{setMessage(text);setTranscript(text);setInputMode('voice');setAuthorize(false);}}/><span className="mc-input-hint">{inputMode==='voice'?'Review your transcript before sending.':mode==='task'?'Held until you approve.':'Your team. One conversation at a time.'}</span><button className="mc-send" aria-label={mode==='task'?`Submit task to ${name} for approval`:`Send to ${name}`} title={authorize?'Send authorized request':'Review and authorize below before sending'} disabled={!ready||busy||!authorize||!message.trim()||!sessionKey} onClick={send}>{busy?<span>…</span>:<ArrowUp size={22}/>}</button></div>
   </section>
   <div className="mc-consent"><label><input type="checkbox" checked={authorize} disabled={busy} onChange={e=>setAuthorize(e.target.checked)}/> I authorize this real tool-enabled request. <span>Standing safety policies apply.</span></label>{!ready&&<button onClick={()=>setPanel('bridge')}>{bridge?.online?'Enable bridge':'Bridge unavailable'} →</button>}</div>
  </div>
  {panel==='bridge'&&<Panel title="Owner bridge" close={()=>{setPanel('');refresh();}}><BridgeControl/><p className="mc-muted">Bridge availability is not a gateway health claim. Real requests may cause side effects; existing profile restrictions are never bypassed.</p></Panel>}
  {panel==='menu'&&<Panel title="Mission Control" side close={()=>setPanel('')}><nav className="mc-nav"><Link href="/" onClick={()=>setPanel('')}>Chat</Link><button onClick={()=>setPanel('tasks')}>Task overview</button><button onClick={()=>setPanel('approvals')}>Approvals <span>{pending.length}</span></button><Link href={`/settings/agents?agentId=${agentId}`}>Agent Management</Link><Link href="/settings">Settings</Link></nav><div className="mc-history-heading"><h3>Conversations · {name}</h3><button aria-label="New conversation" disabled={busy} onClick={newConversation}><Plus size={18}/></button></div><p className="mc-muted">Latest 200 requests for this agent. Choose a recipient in the composer to see their history.</p><input className="mc-search" type="search" aria-label="Search conversation history" placeholder="Search conversation history…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="mc-history">{!filteredHistory.length&&<p className="mc-muted">{search?'No matching conversations.':'No saved conversations yet.'}</p>}{filteredHistory.map(t=><button disabled={busy} aria-current={sessionKey===t.key?'true':undefined} key={t.key} onClick={()=>{selectThread(t.key);setPanel('');}}><span>{t.title}</span><small>{new Date(t.updatedAt).toLocaleDateString()}</small></button>)}</div><button className="mc-source-link" onClick={()=>setPanel('sources')}>Observed profile sources</button></Panel>}
  {panel==='approvals'&&<Panel title="Approval inbox" side close={()=>setPanel('')}><p className="mc-muted">MIA coordinates the team; owner-submitted tasks wait here before execution. Review the exact submitted request. Bridge must be ON to decide.</p>{!pending.length&&<p className="mc-panel-empty">No requests awaiting approval.</p>}{pending.map(r=><article key={r.id} className="mc-approval"><strong>{agents.find(a=>a.id===r.agentId)?.name||r.agentId}</strong><small>{r.kind||'task'} · {new Date(r.createdAt).toLocaleString()}</small><p>{r.prompt}</p><details><summary>Request details</summary><p>{r.id}<br/>Conversation {r.sessionKey}</p></details>{['approve','reject'].map(action=><button key={action} disabled={!ready||busy} onClick={()=>post(`/api/hermes/requests/${r.id}`,{action,bootId:bridge?.bootId},'PATCH')}>{action==='approve'?'Approve exact request':'Reject'}</button>)}</article>)}{note&&<p role="alert" className="mc-error">{note}</p>}</Panel>}
  {panel==='tasks'&&<Panel title="Task overview" side close={()=>setPanel('')}><p className="mc-muted">MIA coordinates the team. This view shows the latest 200 dashboard requests and tasks, with recorded agent assignments and outcomes. It does not invent or imply a backend delegation tracker.</p>{!taskRows.length&&<p className="mc-panel-empty">No recorded dashboard tasks yet. Start with MIA to coordinate the work.</p>}{taskRows.map(r=><article key={r.id} className="mc-approval"><strong>Assigned to {agents.find(a=>a.id===r.agentId)?.name||r.agentId}</strong><small>{r.status.replaceAll('_',' ')} · {new Date(r.createdAt).toLocaleString()}</small><p>{r.prompt}</p>{r.result&&<p>{r.result}</p>}{r.error&&<p className="mc-error">{r.error}</p>}<button disabled={busy} onClick={()=>{selectThread(r.sessionKey,r.agentId);setPanel('');}}>Open conversation</button>{r.status==='awaiting_approval'&&<button onClick={()=>setPanel('approvals')}>Review in approvals</button>}</article>)}</Panel>}
  {panel==='shortcuts'&&<Panel title="Quick tasks" close={()=>setPanel('')}><p className="mc-muted">Saved in this browser. Chips only fill a draft; review, authorize and send separately. Start with MIA for coordination.</p><div className="mc-shortcut-list">{shortcuts.map(s=><div key={s.id}><button onClick={()=>setShortcutDraft({...s})}>{s.label} · {agents.find(a=>a.id===s.agentId)?.name||s.agentId}</button><button aria-label={`Delete ${s.label}`} onClick={()=>{setShortcuts(v=>v.filter(x=>x.id!==s.id));if(shortcutDraft?.id===s.id)setShortcutDraft(null);}}><X size={16}/></button></div>)}</div><button className="mc-secondary" onClick={()=>setShortcutDraft({id:crypto.randomUUID(),label:'',agentId:'default',prompt:'',mode:'chat'})}>Add quick task</button>{shortcutDraft&&<form className="mc-shortcut-form" onSubmit={e=>{e.preventDefault();if(!shortcutDraft.label.trim()||!shortcutDraft.prompt.trim())return;setShortcuts(v=>[...v.filter(s=>s.id!==shortcutDraft.id),{...shortcutDraft,label:shortcutDraft.label.trim(),prompt:shortcutDraft.prompt.trim()}]);setShortcutDraft(null);}}><label>Label<input required maxLength={48} value={shortcutDraft.label} onChange={e=>setShortcutDraft({...shortcutDraft,label:e.target.value})}/></label><label>Agent<select aria-label="Quick task agent" value={shortcutDraft.agentId} onChange={e=>setShortcutDraft({...shortcutDraft,agentId:e.target.value})}>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label><label>Mode<select value={shortcutDraft.mode} onChange={e=>setShortcutDraft({...shortcutDraft,mode:e.target.value as 'chat'|'task'})}><option value="chat">Chat</option><option value="task">Task · approval required</option></select></label><label>Prompt<textarea required rows={4} maxLength={24000} value={shortcutDraft.prompt} onChange={e=>setShortcutDraft({...shortcutDraft,prompt:e.target.value})}/></label><button className="mc-secondary" type="submit">Save quick task</button></form>}</Panel>}
  {panel==='sources'&&<Panel title="Observed profile sources" side close={()=>setPanel('')}><p className="mc-muted">Observed bridge data only. No fabricated model, cost, or token metrics.</p>{agents.map(a=><details key={a.id} className="mc-approval"><summary>{a.name} · {a.status}</summary><p>Observed {a.observedAt||'not yet observed'} · {a.tasksCompleted} completed requests</p>{a.error&&<p>{a.error}</p>}<pre>{JSON.stringify(a.crons??null,null,2)}</pre></details>)}</Panel>}
 </main>;
}
