"use client";
import {useEffect,useState} from 'react';
import Link from 'next/link';
export function ApprovalInbox({compact=false}:{compact?:boolean}){
 const [pending,setPending]=useState<number|null>(null);
 useEffect(()=>{let active=true;const load=async()=>{try{const r=await fetch('/api/hermes/requests?status=awaiting_approval&take=1',{cache:'no-store'});if(!r.ok)throw Error();const b=await r.json();if(active)setPending(b.pending);}catch{if(active)setPending(null);}};load();const timer=setInterval(load,5000);return()=>{active=false;clearInterval(timer);};},[]);
 return <section className="border rounded p-4"><h2>Owner approval inbox</h2><p>{pending===null?'Approval status unavailable':`${pending} requests awaiting approval`}</p><Link href="/agents" className="underline">{compact?'Open Mission Control':'Review profile, full request and approve/reject in Mission Control'}</Link></section>;
}
