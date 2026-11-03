import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import * as collector from '../hermes-bridge/token-collector';
test('read-only collection exports only daily aggregates including auxiliary usage and source failures',()=>{
 assert.equal(typeof collector.collectTokens,'function');
 const dir=mkdtempSync(tmpdir()+'/token-test-'),path=dir+'/state.db',db=new Database(path);
 db.exec(`CREATE TABLE sessions (id TEXT,started_at REAL,ended_at REAL,last_activity_at REAL,cwd TEXT,input_tokens INTEGER,output_tokens INTEGER,cache_read_tokens INTEGER,cache_write_tokens INTEGER,reasoning_tokens INTEGER,actual_cost_usd REAL,estimated_cost_usd REAL,cost_status TEXT,billing_mode TEXT);
 CREATE TABLE messages (session_id TEXT,role TEXT,tool_calls TEXT);
 CREATE TABLE session_model_usage (session_id TEXT,task TEXT,input_tokens INTEGER,output_tokens INTEGER,cache_read_tokens INTEGER,cache_write_tokens INTEGER,reasoning_tokens INTEGER,actual_cost_usd REAL,estimated_cost_usd REAL,cost_status TEXT,billing_mode TEXT);
 INSERT INTO sessions VALUES ('private-session',1793489400,NULL,1793493000,'/opt/data/brain',100,20,80,10,5,NULL,NULL,NULL,NULL);
 INSERT INTO session_model_usage VALUES ('private-session','title_generation',3,2,0,0,0,0,0,NULL,'');
 INSERT INTO messages VALUES ('private-session','user','SECRET PROMPT /opt/data/brain/1-wiki/x');`);
 db.prepare('INSERT INTO messages VALUES (?,?,?)').run('private-session','assistant',JSON.stringify([{function:{name:'read_file',arguments:JSON.stringify({path:'/opt/data/brain/1-wiki/private-name.md'})}}]));
 db.close();const before=readFileSync(path);
 try{
  const profiles=[{id:'default',name:'MIA',home:dir},{id:'yana',name:'YANA',home:dir+'/missing'}];
  const a=collector.collectTokens(profiles,'2026-11-03T00:00:00.000Z');
  assert.deepEqual(a,collector.collectTokens(profiles,'2026-11-03T00:00:00.000Z'));
  assert.equal(a.sources[0].sessions,1);assert.equal(a.sources[0].status,'ready');
  assert.equal(a.sources[1].status,'unavailable');assert.equal(a.rows.length,1);
  assert.equal(a.rows[0].metrics.total,215);assert.equal(a.rows[0].metrics.actualUsd,null);
  assert.equal(a.rows[0].metrics.estimatedUsd,null);assert.equal(a.rows[0].auxiliaryRecords,1);
  assert.equal(a.rows[0].retrieval.kb,1);assert.equal(a.rows[0].retrieval.unknown,0);
  assert.doesNotMatch(JSON.stringify(a),/SECRET|private-session|private-name|\/opt\/data|missing\//);
  assert.deepEqual(readFileSync(path),before);
  const fixtureWriter=new Database(path);fixtureWriter.exec('UPDATE session_model_usage SET estimated_cost_usd=0.25');fixtureWriter.close();
  const recorded=collector.collectTokens(profiles,'2026-11-03T00:00:00.000Z');
  assert.equal(recorded.rows[0].metrics.estimatedUsd,0.25,'nonzero auxiliary estimate is recorded even without status; default zero remains unknown');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
