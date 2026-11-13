// Actual file-backed Worker and local HTTP. Original source, admission, Runner,
// automatic reports and browser identity are explicit protocol fixtures.
import {once} from 'node:events';import {createRequire} from 'node:module';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {acceptanceFixture} from './acceptance.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export async function reviewEntryFixture(t,{browser=false,...options}={}){
  const f=await acceptanceFixture(t,{register:false,reviewed:false,human:true,humanWork:true,...options}),app=express();
  const facade={storage:{request:(...args)=>f.storage.request(...args)}};
  const api=mountInputApi(app,facade,{enabled:true,baseline:{version:'review.fixture.v1',baseCommit:'b'.repeat(40)},identityResolver:req=>browser?{principalId:'user_1'}:req.headers.authorization==='Bearer fixture_review_owner'?{principalId:'user_1'}:req.headers.authorization==='Bearer fixture_review_viewer'?{principalId:'review.viewer'}:null});
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const origin='http://127.0.0.1:'+server.address().port,base='/api/v1/runs/'+f.p.runId+'/candidates/'+f.candidate.candidateId+'/review',headers={authorization:'Bearer fixture_review_owner'};
  const read=async()=>{const r=await fetch(origin+base,{headers});if(r.status!==200)throw Error('Review HTTP '+r.status+' '+await r.text());return {response:r,entry:await r.json()};};
  const write=(kind,body,{key=crypto.randomUUID(),match,...extra}={})=>fetch(origin+base+'/'+kind,{method:'POST',headers:{...headers,'content-type':'application/json','idempotency-key':key,...(match===undefined?{}:{'if-match':match}),...extra},body:JSON.stringify(body)});
  return {...f,origin,base,page:origin+base+'/view',headers,server,api,read,write};
}
export function resultBody(entry,item,extra={}){return {manifestHash:entry.review.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:item.result?.resultId??null,verdict:'PASS',procedure:'Explicit HTTP fixture performs this check.',expected:item.expected,observed:'Explicit fixture observation; not human product acceptance.',evidence:[],...extra};}
