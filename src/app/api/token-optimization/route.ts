import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {ownerRequest} from '@/lib/owner-request';
import {loadTokenReport} from '@/lib/token-report';
import {TOKEN_USAGE_KEY} from '@/lib/token-snapshot';
export const dynamic='force-dynamic';
export async function GET(){
 const denied=await ownerRequest();if(denied)return denied;
 const report=await loadTokenReport(()=>prisma.dataStore.findUnique({where:{key:TOKEN_USAGE_KEY}}));
 return NextResponse.json(report,{headers:{'Cache-Control':'no-store'}});
}
