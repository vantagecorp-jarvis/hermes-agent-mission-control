"use client";
import Link from 'next/link';
import {useCallback,useEffect,useState} from 'react';
import {BridgeControl} from './bridge-control';
import {VoiceDictation} from './voice-dictation';
type Agent={id:string;name:string;status:string;tasksCompleted:number;lastActive?:string;crons?:unknown[];observedAt?:string;error?:string};
type Row={inputMode?:string;transcript?:string;id:string;agentId:string;sessionKey:string;prompt:string;status:string;result?:string;error?:string;createdAt:string;authorizedAt?:string;decidedAt?:string};
export function BridgeStatus(){
 const [label,setLabel]=useState('Bridge UNKNOWN');
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/hermes/bridge',{cache:'no-store'});if(!r.ok)throw Error();const b=await r.json();if(active)setLabel(b.online?b.enabled?'Bridge ON':'Bridge OFF':'Bridge OFFLINE');}catch{if(active)setLabel('Bridge UNKNOWN');}};load();const t=setInterval(load,3000);return()=>{active=false;clearInterval(t);};},[]);
 return <span role="status">{label}</span>;
}
export function MissionControl(){
 const [agents,setAgents]=useState<Agent[]>([]),[agentId,setAgentId]=useState('default'),[sessionKey,setSessionKey]=useState(''),[rows,setRows]=useState<Row[]>([]),[pending,setPending]=useState<Row[]>([]);
 const [inputMode,setInputMode]=useState('text'),[transcript,setTranscript]=useState('');
 const [bridge,setBridge]=useState<{enabled:boolean;online:boolean;bootId:string}|null>(null),[message,setMessage]=useState(''),[mode,setMode]=useState('chat'),[authorize,setAuthorize]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let key=localStorage.getItem(`mc-thread-${agentId}`);if(!key){key=crypto.randomUUID();localStorage.setItem(`mc-thread-${agentId}`,key);}setSessionKey(key);setRows([]);},[agentId]);
 const refresh=useCallback(async()=>{try{
  const responses=await Promise.all([fetch('/api/agents',{cache:'no-store'}),fetch('/api/hermes/bridge',{cache:'no-store'}),fetch(`/api/hermes/requests?agentId=${agentId}&take=200`,{cache:'no-store'}),fetch('/api/hermes/requests?status=awaiting_approval&take=200',{cache:'no-store'})]);
  if(responses.some(r=>!r.ok))throw Error('Could not refresh live state');
  const [a,b,r,p]=await Promise.all(responses.map(r=>r.json()));setAgents(a);setBridge(b);setRows(r.requests);setPending(p.requests);
 }catch(e){setBridge(null);setNote((e as Error).message);}},[agentId]);
 useEffect(()=>{refresh();const t=setInterval(refresh,2500);return()=>clearInterval(t);},[refresh]);
 async function post(url:string,body:object,method='POST'){
  setBusy(true);setNote('');try{const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!r.ok)throw Error(b.error||'Request failed');return true;}catch(e){setNote((e as Error).message);return false;}finally{setBusy(false);await refresh();}
 }
 async function send(){if(await post('/api/hermes/dispatch',{agentId,sessionKey,message,mode,authorize,bootId:bridge?.bootId,inputMode,transcript})){setMessage('');setAuthorize(false);setInputMode('text');setTranscript('');}}
 const ready=!!bridge?.online&&bridge.enabled;
 return <main className="space-y-6 pb-16">
  <header className="flex justify-between items-center"><h1 className="text-3xl font-semibold">Mission Control</h1><BridgeStatus/></header>
  <BridgeControl/>
  <p className="text-sm">Direct owner access to MIA and all registered heads. Normal reporting remains through MIA. Real tools, profile configuration, SOUL, skills and memory are loaded; messages can cause side effects. Standing restrictions still apply. Dangerous actions denied by Hermes are not bypassed here.</p>
  <div className="flex gap-2 flex-wrap">{agents.map(a=><button key={a.id} onClick={()=>{setAgentId(a.id);setMessage('');setAuthorize(false);setInputMode('text');setTranscript('');}} className={`border rounded p-3 ${agentId===a.id?'border-blue-400':''}`}>{a.name} · {a.status}<br/><small>{a.tasksCompleted} completed MC requests</small></button>)}</div>
  <section className="border rounded-xl p-4 space-y-3">
   <h2 className="font-semibold">{agents.find(a=>a.id===agentId)?.name||agentId} · thread {sessionKey}</h2>
   <Link className="underline block" href={`/settings/agents?agentId=${agentId}`}>View actual SOUL.md / manage this agent</Link>
   <button className="btn-ghost" onClick={()=>{const key=crypto.randomUUID();localStorage.setItem(`mc-thread-${agentId}`,key);setSessionKey(key);}}>New conversation</button>
   <label className="block">Conversation <select aria-label="Conversation" value={sessionKey} onChange={e=>{setSessionKey(e.target.value);localStorage.setItem(`mc-thread-${agentId}`,e.target.value);}} className="bg-[var(--surface-1)] border p-2 rounded"><option value={sessionKey}>{sessionKey}</option>{[...new Set(rows.map(r=>r.sessionKey).filter(k=>k&&k!==sessionKey))].map(k=><option key={k} value={k}>{k}</option>)}</select></label>
   <label className="block">Mode <select value={mode} onChange={e=>setMode(e.target.value)} className="bg-[var(--surface-1)] border p-2 rounded"><option value="chat">Send authorized message now</option><option value="task">Task — hold for owner approval</option></select></label>
   <VoiceDictation key={agentId+sessionKey} onTranscript={text=>{setMessage(text);setTranscript(text);setInputMode('voice');setAuthorize(false);}}/>
   <p>Input: {inputMode}. Transcript preview is editable below.</p>
   <textarea aria-label="Agent message or task" value={message} onChange={e=>setMessage(e.target.value)} maxLength={24000} rows={4} className="w-full bg-transparent border rounded p-3" placeholder="Message, task, workflow or report request"/>
   <label className="block"><input type="checkbox" checked={authorize} onChange={e=>setAuthorize(e.target.checked)}/> I authorize this real tool-enabled owner request under existing standing policies (not a safety bypass).</label>
   <button className="btn-ghost border rounded p-2" disabled={!ready||busy||!authorize||!message.trim()||!sessionKey} onClick={send}>{mode==='task'?'Submit for approval':'Authorize & send'}</button>
   <p role="alert">{note}</p>{!ready&&<p>Execution unavailable: enable the current bridge with your owner password first.</p>}
  </section>
  <section className="space-y-3"><h2 className="text-xl">Approval inbox</h2>{!pending.length&&<p>No requests awaiting approval.</p>}{pending.map(r=><article key={r.id} className="border rounded p-4"><strong>{r.agentId} · {r.sessionKey}</strong><p className="whitespace-pre-wrap my-2">{r.prompt}</p>{['approve','reject'].map(action=><button key={action} disabled={!ready||busy} className="btn-ghost border rounded p-2 mr-2" onClick={()=>post(`/api/hermes/requests/${r.id}`,{action,bootId:bridge?.bootId},'PATCH')}>{action}</button>)}</article>)}</section>
  <section className="space-y-3"><h2 className="text-xl">Durable conversation & task results</h2><p className="text-sm">Latest 200 requests for this profile. Select a prior thread above. Status polls every 2.5 seconds; no invented progress percentage. A running task after a bridge crash has an unknown outcome — inspect before resubmitting.</p>{rows.filter(r=>r.sessionKey===sessionKey).reverse().map(r=><article key={r.id} className="border rounded-xl p-4 space-y-2"><small>{r.createdAt} · {r.inputMode||'text'} · {r.status} · {r.id}</small><p className="whitespace-pre-wrap">Owner: {r.prompt}</p>{r.transcript&&<details><summary>Original voice transcript</summary><p className="whitespace-pre-wrap">{r.transcript}</p></details>}{r.result&&<pre className="whitespace-pre-wrap break-words font-sans">{r.agentId}: {r.result}</pre>}{r.error&&<p role="alert" className="whitespace-pre-wrap text-red-400">{r.error}</p>}<small>Authorized: {r.authorizedAt||'none'} · Decision: {r.decidedAt||'pending'}</small></article>)}</section>
  <section><h2 className="text-xl">Observed profile sources</h2><p>Bridge availability is not a gateway health claim. Cost/model token metrics are not fabricated.</p>{agents.map(a=><details key={a.id} className="border rounded p-3 my-2"><summary>{a.name} · source observed {a.observedAt||'not yet observed'}</summary>{a.error&&<p>{a.error}</p>}<pre className="whitespace-pre-wrap">{JSON.stringify(a.crons??null,null,2)}</pre></details>)}</section>
 </main>;
}
