"use client";
import {useEffect,useRef,useState} from 'react';
// Browser dictation only: no server recording, no claimed universal support.
export function VoiceDictation({onTranscript}:{onTranscript:(text:string)=>void}){
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[note,setNote]=useState('');
 const recognition=useRef<any>(null);
 useEffect(()=>{const w=window as any;setSupported(!!(w.SpeechRecognition||w.webkitSpeechRecognition)&&window.isSecureContext);return()=>recognition.current?.abort();},[]);
 function start(){try{const w=window as any,R=w.SpeechRecognition||w.webkitSpeechRecognition,r=new R();recognition.current=r;r.lang=navigator.language||'en-US';r.continuous=false;r.interimResults=false;r.onresult=(event:any)=>{const text=Array.from(event.results as any[]).map((result:any)=>result[0].transcript).join(' ');onTranscript(text);setNote('Transcript inserted below. Review/edit it, then explicitly authorize and send.');};r.onerror=(event:any)=>{setNote(`Dictation failed: ${event.error}. Type your request instead.`);setListening(false);};r.onend=()=>setListening(false);r.start();setListening(true);setNote('Listening — nothing is sent to the agent until you authorize and submit.');}catch{setNote('Microphone unavailable. Type your request instead.');setListening(false);}}
 return <div className="space-y-2"><button type="button" className="btn-ghost border rounded p-2" disabled={!supported} onClick={()=>listening?recognition.current?.stop():start()}>{listening?'Stop microphone':'Dictate voice command'}</button><p className="text-sm">{supported?'Browser speech recognition may send audio to your browser vendor. Text replies only; audio is not stored by Mission Control.':'Voice dictation unavailable in this browser or insecure context. Use a supported Chromium browser over HTTPS, or type your request.'}</p><p role="status">{note}</p></div>;
}
