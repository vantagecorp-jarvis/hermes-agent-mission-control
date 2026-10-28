import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
export async function GET(){
 const row=await prisma.bridgeControl.findUnique({where:{id:'owner'}});
 const online=!!row&&Date.now()-row.heartbeatAt.getTime()<15000;
 return NextResponse.json({online,enabled:online&&row?.enabled===true,gateway:'unknown',detail:online?'Mission Control bridge heartbeat only; not a gateway probe':'Bridge offline/unknown',lastSeen:row?.heartbeatAt??null},{headers:{'Cache-Control':'no-store'}});
}
