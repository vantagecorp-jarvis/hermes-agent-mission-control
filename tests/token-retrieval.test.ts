import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as retrieval from '../hermes-bridge/token-retrieval';
const call=(name:string,args:unknown)=>JSON.stringify([{function:{name,arguments:JSON.stringify(args)}}]);
test('bounded parser stops consuming evidence after the session byte budget',()=>{
 function* records(){for(let i=0;i<70;i++)yield ' '.repeat(65536);throw Error('unbounded read');}
 assert.doesNotThrow(()=>retrieval.classifyRetrieval(records(),'/'));
});
test('only bounded structured retrieval calls classify evidence, never prompt/path mentions or writes',()=>{
 assert.equal(typeof retrieval.classifyRetrieval,'function');
 const classify=(calls:string[],cwd='/opt/data/brain')=>retrieval.classifyRetrieval(calls,cwd);
 assert.equal(classify([]).kind,'unknown');
 assert.equal(classify([call('write_file',{path:'/opt/data/brain/1-wiki/x'})]).kind,'unknown');
 assert.equal(classify([call('read_file',{path:'/tmp/1-wiki/x'})]).kind,'unknown');
 assert.equal(classify([call('read_file',{path:'1-wiki/index.md'})]).kind,'kb');
 assert.equal(classify([call('search_files',{path:'/opt/data/brain/0-raw',pattern:'x'})]).kind,'kb');
 assert.equal(classify([call('read_file',{path:'/opt/data/brain/1-wiki/../../secrets'})]).kind,'unknown');
 assert.equal(classify([call('web_search',{query:'private query'})]).kind,'external');
 assert.equal(classify([call('read_file',{path:'1-wiki/x'}),call('web_extract',{urls:['https://example.org']})]).kind,'mixed');
 assert.equal(classify([call('read_file',{path:'1-wiki/x'}),call('web_search',{query:'x'}),'{bad']).kind,'mixed','positive evidence of both survives incomplete coverage');
 assert.equal(classify(['{bad']).incomplete,true);
 assert.equal(classify(['x'.repeat(65537)]).kind,'unknown');
 assert.equal(classify([call('multi_tool_use.parallel',{tool_uses:[{recipient_name:'functions.read_file',parameters:{path:'1-wiki/x'}}]})]).kind,'kb');
 assert.equal(classify([call('multi_tool_use.parallel',{tool_uses:Array.from({length:101},()=>({recipient_name:'functions.read_file',parameters:{path:'1-wiki/x'}}))})]).incomplete,true);
 assert.doesNotMatch(JSON.stringify(classify([call('web_search',{query:'private query'})])),/private|query|example/);
});
