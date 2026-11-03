import {validTokenSnapshot} from './token-snapshot';
import type {TokenSnapshot} from './token-usage';
export type TokenReport={status:'ready'|'not-imported'|'disconnected'|'invalid';stale:boolean;snapshot:TokenSnapshot|null};
export async function loadTokenReport(read:()=>Promise<{data:unknown}|null>,now=Date.now()):Promise<TokenReport>{
 try{
  const row=await read();
  if(!row)return {status:'not-imported',stale:true,snapshot:null};
  if(!validTokenSnapshot(row.data))return {status:'invalid',stale:true,snapshot:null};
  const age=now-Date.parse(row.data.collectedAt);
  return {status:'ready',stale:age>30*60*1000||age< -60000,snapshot:row.data};
 }catch{return {status:'disconnected',stale:true,snapshot:null};}
}
