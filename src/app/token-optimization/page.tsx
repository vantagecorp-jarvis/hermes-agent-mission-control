import {getServerSession} from 'next-auth';
import {redirect} from 'next/navigation';
import {authOptions} from '@/lib/auth';
import {TokenOptimization} from '@/components/token-optimization';
import './token.css';
export const dynamic='force-dynamic';
export default async function Page(){
 if((await getServerSession(authOptions))?.user?.id!=='owner')redirect('/login');
 return <TokenOptimization/>;
}
