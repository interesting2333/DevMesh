import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
import {meta} from './fixtures/storage-data.mjs';
import {acceptanceEntryFixture,beginBody,commitBody} from './fixtures/acceptance-entry.mjs';

const clean=value=>{const text=JSON.stringify(value);for(const privateName of ['storageKey','backendPrincipalId','backendRef','runnerId','endpoint','instanceId','preparedProof','targetFence','claimHash','physical'])assert.equal(text.includes('"'+privateName+'"'),false,privateName);};
const state=f=>Object.fromEntries(['releases','acceptance_commits','release_promotion_outbox','acceptance_preparations','acceptance_abort_decisions'].map(table=>[table,f.get('SELECT count(*) n FROM '+table).n]));
async function begin(f){const {response,basis}=await f.read(),result=await f.httpPost(f.base+'/preparations',beginBody(basis),{match:response.headers.get('etag')});assert.equal(result.status,202,await result.clone().text());return result.json();}
async function detail(f,id,options){const result=await f.httpGet(f.base+'/preparations/'+id,options);assert.equal(result.status,200,await result.clone().text());return {response:result,preparation:await result.json()};}

test('acceptance basis is inert and new actions require current explicit host policy and owner',{timeout:240000},async t=>{
  const f=await acceptanceEntryFixture(t),before=state(f),{response,basis}=await f.read();assert.equal(basis.canPrepare,true);assert.equal(basis.canManage,true);assert.equal(basis.policyHash,f.policyHash);assert.equal(basis.codeCommit,f.candidate.manifest.codeCommit);assert.equal(basis.dataPlan.strategy,'INITIAL');assert.equal(basis.canConfirmReplacement,false);clean(basis);assert.deepEqual(state(f),before);
  const disabled=await f.mount(false),unavailable=await f.httpGet(f.base,{origin:disabled.origin});const b=await unavailable.json();assert.equal(b.configured,false);assert.equal(b.canPrepare,false);assert.equal(b.reason,'BACKEND_UNAVAILABLE');assert.equal((await f.httpPost(f.base+'/preparations',beginBody(basis),{origin:disabled.origin,match:response.headers.get('etag')})).status,503);
  assert.equal((await f.httpPost(f.base+'/preparations',{...beginBody(basis),backendPrincipalId:'forged'},{match:response.headers.get('etag')})).status,422);
  assert.equal((await f.httpPost(f.base+'/preparations',beginBody(basis))).status,428);assert.equal((await f.httpPost(f.base+'/preparations',beginBody(basis),{match:'"r1"'})).status,412);
  f.run('INSERT INTO project_members VALUES(?,?,?,?)',f.p.projectId,'acceptance.viewer','viewer',new Date().toISOString());const viewer={authorization:'Bearer fixture_acceptance_viewer'},v=await (await f.httpGet(f.base,{headers:viewer})).json();assert.equal(v.canManage,false);assert.equal(v.canPrepare,false);assert.equal((await f.httpPost(f.base+'/preparations',beginBody(basis),{match:response.headers.get('etag'),headers:viewer})).status,403);
  assert.equal((await fetch(f.origin+f.base)).status,401);assert.equal((await f.httpGet(f.base+'?policyHash='+f.policyHash)).status,422);
  const {policyHash:_policy,...replacement}=beginBody(basis);assert.equal((await f.httpPost(f.base+'/replacement-confirmations',{...replacement,decisionId:'decision_not_applicable',confirmation:'REPLACE_ACCEPTED_DATA'},{match:response.headers.get('etag')})).status,409);assert.deepEqual(state(f),before);
  // The installed project policy is a snapshot, never a caller-mutable pointer.
  f.policies[f.p.projectId]='f'.repeat(64);const p=await begin(f);assert.equal(p.state,'PREPARED');assert.equal(p.readiness.state,'UNPREPARED');assert.equal(p.canCommit,false);assert.equal(p.canCloseUnsent,true);clean(p);assert.equal(f.fault.reads,0);
});

test('preparation HTTP recovers the same original after restart and fails closed on mismatched scope or revoked membership',{timeout:240000},async t=>{
  const f=await acceptanceEntryFixture(t),{response,basis}=await f.read(),body=beginBody(basis),key=crypto.randomUUID(),match=response.headers.get('etag'),path=f.base+'/preparations';
  const saved=await f.httpPost(path,body,{key,match});assert.equal(saved.status,202);const p=await saved.json();await f.reopen();const disabled=await f.mount(false),recovered=await f.httpPost(path,body,{key,match,origin:disabled.origin});assert.equal(recovered.status,202);assert.equal((await recovered.json()).operationId,p.operationId);assert.equal(state(f).acceptance_preparations,1);
  assert.equal((await f.httpPost(path,{...body,reviewHash:'d'.repeat(64)},{key,match})).status,409);assert.equal((await f.httpPost(path,body,{match:(await f.read()).response.headers.get('etag')})).status,409);
  const foreign=f.base.replace(f.candidate.candidateId,'candidate_foreign');assert.equal((await f.httpGet(foreign+'/preparations/'+p.operationId)).status,404);
  f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');for(const url of [f.base,path,path+'/'+p.operationId])assert.equal((await f.httpGet(url)).status,404);assert.equal((await f.httpPost(path,body,{key,match})).status,404);
});

test('actual material preflight precedes HTTP T5 and committed ACK recovery preserves one accepted release',{timeout:300000},async t=>{
  const f=await acceptanceEntryFixture(t,{human:true,humanWork:true}),p=await begin(f);await f.ready(p.operationId);const {response,preparation}=await detail(f,p.operationId);assert.equal(preparation.canCommit,true);assert.equal(preparation.canAbort,true);assert.equal(preparation.readiness.state,'READY');clean(preparation);
  const input=commitBody(preparation),key=crypto.randomUUID(),match=response.headers.get('etag'),path='/api/v1/candidates/'+f.candidate.candidateId+':accept',quality=f.get('SELECT evaluation_json FROM work_verifications WHERE operation_id=?',f.candidate.manifest.works.find(w=>w.relation==='MANUAL_PENDING').operationId).evaluation_json;
  f.fault.corrupt=true;assert.equal((await f.httpPost(path,input,{key,match})).status,409);assert.equal(state(f).releases,0);assert.equal(await f.storage.request('lookupOperation',{principalId:'user_1',scopeId:f.p.runId,idempotencyKey:key}),null);
  f.fault.corrupt=false;f.fault.dropCommitAck=true;const lost=await f.httpPost(path,input,{key,match});assert.equal(lost.status,503);assert.equal(state(f).releases,1);assert.equal(state(f).release_promotion_outbox,1);assert.equal((await f.storage.request('getRun',{runId:f.p.runId})).terminalOutcome,'COMPLETED');
  const reads=f.fault.reads;assert.ok(reads>1);await f.reopen();f.fault.denyReads=true;const disabled=await f.mount(false),recovery=await f.httpPost(path,input,{key,match,origin:disabled.origin});assert.equal(recovery.status,202,await recovery.clone().text());const receipt=await recovery.json();assert.equal(receipt.status,'SUCCEEDED');assert.equal(receipt.result.acceptanceState,'ACCEPTED');assert.equal(receipt.result.publicationState,'PENDING');clean(receipt);assert.equal(f.fault.reads,reads);
  const status=await f.httpGet(receipt.links.preparation,{origin:disabled.origin});assert.equal(status.status,200);assert.equal((await status.json()).resolution,'COMMITTED');assert.equal((await f.httpPost(path,{...input,proofHash:'e'.repeat(64)},{key,match,origin:disabled.origin})).status,409);assert.equal((await f.httpPost(path,input,{match,origin:disabled.origin})).status,503);
  assert.equal(state(f).releases,1);assert.equal(state(f).release_promotion_outbox,1);assert.equal(f.get('SELECT evaluation_json FROM work_verifications WHERE operation_id=?',f.candidate.manifest.works.find(w=>w.relation==='MANUAL_PENDING').operationId).evaluation_json,quality);assert.equal(f.get('SELECT count(*) n FROM work_acceptance_completions').n,1);assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,receipt.result.releaseId);
  f.run('UPDATE project_members SET role=? WHERE project_id=? AND principal_id=?','viewer',f.p.projectId,'user_1');assert.equal((await f.httpPost(path,input,{key,match})).status,403);
});

test('HTTP close-unsent and sent abort retain original decisions without claiming physical cleanup',{timeout:240000},async t=>{
  const f=await acceptanceEntryFixture(t),first=await begin(f),d=await detail(f,first.operationId),close=f.base+'/preparations/'+first.operationId+'/close-unsent',body={requestHash:first.requestHash},key=crypto.randomUUID(),match=d.response.headers.get('etag');
  const closed=await f.httpPost(close,body,{key,match});assert.equal(closed.status,200);assert.equal((await closed.json()).resolution,'UNSENT_FAILED');assert.equal((await f.httpPost(close,body,{key,match})).status,200);
  const p=await begin(f);await f.ready(p.operationId);const current=await detail(f,p.operationId),path=f.base+'/preparations/'+p.operationId,abort={requestHash:p.requestHash,expectedPreparationRevision:current.preparation.revision,reason:'Explicit HTTP fixture requests cleanup; no physical completion claimed.',confirmation:'ABORT_ACCEPTANCE_PREPARATION'},abortKey=crypto.randomUUID(),tag=current.response.headers.get('etag');
  assert.equal((await f.httpPost(path+'/close-unsent',{requestHash:p.requestHash},{match:tag})).status,409);const result=await f.httpPost(path+'/abort',abort,{key:abortKey,match:tag});assert.equal(result.status,202);const receipt=await result.json();clean(receipt);assert.equal(receipt.decisionState,'RECORDED');await f.reopen();assert.deepEqual(await (await f.httpPost(path+'/abort',abort,{key:abortKey,match:tag})).json(),receipt);
  assert.equal((await detail(f,p.operationId)).preparation.resolution,'ABORTING');assert.equal((await detail(f,p.operationId)).preparation.canCommit,false);assert.equal(state(f).acceptance_abort_decisions,1);assert.equal(state(f).releases,0);assert.equal(f.get('SELECT count(*) n FROM acceptance_abort_completions').n,0);assert.equal(f.get('SELECT count(*) n FROM datasets').n,2);
});

test('candidate preparation history uses bounded stable cursor pages and unregistered policies stay unavailable',{timeout:300000},async t=>{
  const f=await acceptanceEntryFixture(t,{register:false}),unregistered=await f.read();assert.equal(unregistered.basis.configured,false);assert.equal(unregistered.basis.canPrepare,false);assert.equal((await f.httpPost(f.base+'/preparations',{...beginBody(unregistered.basis),policyHash:f.policyHash},{match:unregistered.response.headers.get('etag')})).status,503);
  await f.storage.request('registerAcceptanceBackendPolicy',f.registration);const ids=[];
  const profile={at:new Date().toISOString(),setup:[],pages:[]},started=performance.now();t.after(async()=>{await mkdir('.cache/p130-evidence',{recursive:true});await writeFile('.cache/p130-evidence/history-profile-'+Date.now()+'.json',JSON.stringify(profile,null,2)+'\n');});
  // One actual HTTP create/close plus real Worker originals for page setup.
  // Other cases cover owner, CAS, original HTTP recovery and close/abort.
  for(let n=0;n<21;n++){
    const p=n===0?await begin(f):await f.call('beginAcceptancePreparation',await f.request());ids.push(p.operationId);
    if(n===0){const {response}=await detail(f,p.operationId);assert.equal((await f.httpPost(f.base+'/preparations/'+p.operationId+'/close-unsent',{requestHash:p.requestHash},{match:response.headers.get('etag')})).status,200);}
    else {const current=await f.call('getRun',{runId:f.p.runId});await f.call('failUnsentAcceptancePreparation',{meta:meta(f.p.runId),runId:f.p.runId,operationId:p.operationId,requestHash:p.requestHash,ifMatch:'"r'+current.resourceRevision+'"'});}
    profile.setup.push({count:n+1,elapsedMs:performance.now()-started});
  }
  const listStarted=performance.now();
  const workerRequests=[],originalRequest=f.storage.request;
  f.storage.request=function(...args){workerRequests.push(args[0]);return originalRequest.apply(this,args);};
  let page;try{page=await (await f.httpGet(f.base+'/preparations?limit=20')).json();}finally{f.storage.request=originalRequest;}
  profile.pages.push({items:page.items.length,elapsedMs:performance.now()-listStarted,workerRequests});
  assert.ok(workerRequests.length<=5,'Page reads must have a fixed Worker round-trip budget');assert.equal(page.items.length,20);assert.deepEqual(page.items.map(i=>i.preparation.operationId),ids.slice(0,20));assert.ok(page.nextSequence);clean(page);
  const next=await (await f.httpGet(f.base+'/preparations?limit=20&afterSequence='+page.nextSequence)).json();assert.equal(next.items.length,1);assert.equal(next.items[0].preparation.operationId,ids[20]);assert.equal(next.nextSequence,null);profile.pages.push({items:next.items.length,elapsedMs:performance.now()-listStarted});
  for(const query of ['limit=101','limit=0','afterSequence=-1','afterSequence=9007199254740992','unknown=1'])assert.equal((await f.httpGet(f.base+'/preparations?'+query)).status,422,query);assert.equal(state(f).releases,0);assert.equal(f.fault.reads,0);
  f.run('UPDATE project_members SET role=? WHERE project_id=? AND principal_id=?','viewer',f.p.projectId,'user_1');
  const demoted=await (await f.httpGet(f.base+'/preparations?limit=20')).json();assert.equal(demoted.items.length,20);assert.ok(demoted.items.every(({preparation:p})=>p.qualification==='STALE'&&!p.canCommit&&!p.canCloseUnsent&&!p.canAbort));
  f.run('UPDATE project_members SET role=? WHERE project_id=? AND principal_id=?','owner',f.p.projectId,'user_1');
  const restored=await (await f.httpGet(f.base+'/preparations?limit=20')).json();assert.ok(restored.items.every(({preparation:p})=>p.qualification==='CURRENT'));
  f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');assert.equal((await f.httpGet(f.base+'/preparations?limit=20')).status,404);
});
