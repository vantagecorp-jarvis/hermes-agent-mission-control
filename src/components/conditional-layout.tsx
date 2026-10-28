'use client';
import Link from 'next/link';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {Menu,X} from 'lucide-react';

export function ConditionalLayout({children}:{children:React.ReactNode}){
 const pathname=usePathname(),[open,setOpen]=useState(false);
 if(pathname==='/login'||['/','/agents','/hermes','/tasks'].includes(pathname))return <>{children}</>;
 const management=pathname.startsWith('/settings');
 return <div className={management?'mc-management':'mc-legacy'}><header className="mc-header"><button className="mc-icon" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button><Link href="/" className="mc-brand">Mission Control.</Link><Link href="/" className="mc-back-chat">Back to chat →</Link></header>{open&&<nav className="mc-compact-nav"><Link href="/" onClick={()=>setOpen(false)}>Chat</Link><Link href="/tasks" onClick={()=>setOpen(false)}>Tasks / Approvals</Link><Link href="/settings/agents" onClick={()=>setOpen(false)}>Agent Management</Link><Link href="/settings" onClick={()=>setOpen(false)}>Settings</Link></nav>}<div className="mc-page-content">{children}</div></div>;
}
