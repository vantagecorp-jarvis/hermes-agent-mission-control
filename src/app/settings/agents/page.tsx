import {AgentManagement} from '@/components/agent-management';
export default async function Page({searchParams}:{searchParams:Promise<{agentId?:string}>}){const {agentId}=await searchParams;return <AgentManagement key={agentId||'default'} initialAgent={agentId||'default'}/>;}
