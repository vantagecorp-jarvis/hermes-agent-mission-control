import {isDeepStrictEqual} from 'node:util';
import {TOKEN_USAGE_KEY,validTokenSnapshot} from '../src/lib/token-snapshot';
import type {TokenSnapshot} from '../src/lib/token-usage';
export {validTokenSnapshot};
type Store={query:(sql:string,args?:unknown[])=>Promise<{rows:{data?:unknown}[]}>};
export async function ingestTokens(db:Store,snapshot:TokenSnapshot){
 if(!validTokenSnapshot(snapshot))throw Error('Invalid sanitized token snapshot');
 await db.query(`INSERT INTO "DataStore" (key,data,"updatedAt") VALUES ($1,$2::jsonb,now()) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data,"updatedAt"=EXCLUDED."updatedAt"`,[TOKEN_USAGE_KEY,JSON.stringify(snapshot)]);
 const result=await db.query(`SELECT data FROM "DataStore" WHERE key=$1`,[TOKEN_USAGE_KEY]);
 if(!isDeepStrictEqual(result.rows[0]?.data,snapshot))throw Error('Token snapshot readback verification failed');
}
