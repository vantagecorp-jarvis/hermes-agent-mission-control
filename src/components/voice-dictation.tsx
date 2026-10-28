"use client";
import {useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
type RecognitionEvent={results:ArrayLike<ArrayLike<{transcript:string}>>};
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:(event:RecognitionEvent)=>void;onerror:(event:{error:string})=>void;onend:()=>void;start:()=>void;stop:()=>void;abort:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
// Browser dictation only; no server recording or unsupported audio reply controls.
export function VoiceDictation({onTranscript,compact=false,disabled=false}:{onTranscript:(text:string)=>void;compact?:boolean;disabled?:boolean}){
 const [supported,setSupported]=useState(false),[listening,setListening]=useState(false),[note,setNote]=useState('');
 const recognition=useRef<Recognition|null>(null);
 useEffect(()=>{const w=window as SpeechWindow;setSupported(!!(w.SpeechRecognition||w.webkitSpeechRecognition)&&window.isSecureContext);return()=>recognition.current?.abort();},[]);
 function start(){try{const w=window as SpeechWindow,R=w.SpeechRecognition||w.webkitSpeechRecognition;if(!R)return;const r=new R();recognition.current=r;r.lang=navigator.language||'en-US';r.continuous=false;r.interimResults=false;r.onresult=event=>{onTranscript(Array.from(event.results).map(result=>result[0].transcript).join(' '));setNote('Transcript inserted. Review/edit, then authorize and send.');};r.onerror=event=>{setNote(`Dictation failed: ${event.error}. Type instead.`);setListening(false);};r.onend=()=>setListening(false);r.start();setListening(true);setNote('Listening. Nothing is sent until you authorize and submit.');}catch{setNote('Microphone unavailable. Type instead.');setListening(false);}}
 const info=supported?'Browser dictation may send audio to your browser vendor. Mission Control stores text only.':'Dictation unavailable in this browser or insecure context. Type instead, or use a supported browser over HTTPS.';
 return <div className={compact?'mc-dictation':'space-y-2'}><button type="button" className={compact?'mc-icon':'btn-ghost p-2'} aria-label={listening?'Stop dictation':'Dictate message'} title={info} disabled={!supported||disabled} onClick={()=>listening?recognition.current?.stop():start()}>{compact?(listening?<Square size={18}/>:<Mic size={20}/>):listening?'Stop microphone':'Dictate voice command'}</button>{!compact&&<p className="text-sm">{info}</p>}{note&&<p className={compact?'mc-dictation-note':''} role="status">{note}</p>}</div>;
}
