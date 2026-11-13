// Two actual candidate/assessment/review/T5 transactions in one file-backed
// control database. Source Git, model/Runtime/admission, generated OCI bytes,
// physical fences and container/network/route facts remain explicit fixtures.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {RunnerAcceptancePreparationBackend} from '../../packages/runner/dist/index.mjs';
import {AcceptancePreparer,ReleaseAcceptor} from '../../packages/platform-core/dist/index.mjs';
import {releaseServiceFixture} from './release-service.mjs';
import {releaseFreezeFixture} from './release-freeze.mjs';
import {copyPlan} from './acceptance-datasets.mjs';
import {canonical,hash,meta,content} from './storage-data.mjs';

export async function acceptanceSuccessorFixture(t,{strategy='PRESERVE_MIGRATE',initialData='EMPTY'}={}){
 const first=await releaseServiceFixture(t),control=first.control,observation=await first.backend.publish(first.publication,async()=>true);
 assert.equal(observation.state,'PUBLISHED');
 await control.call('recordReleasePublicationObservation',{principalId:first.options.principalId,releaseId:first.publication.releaseId,requestHash:first.publication.requestHash,expectedRevision:first.publication.revision,expectedSequence:first.publication.sequence,observation});
 const write=await fetch(first.origin+'/api/tasks',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({title:'Accepted source business row',description:'Must survive preserve and remain in the retired replacement source.',status:'doing'}),signal:AbortSignal.timeout(120000)});
 assert.equal(write.status,201,await write.clone().text());const sourceTask=(await write.json()).task,sourcePreparation=first.preparation,sourceReleaseId=sourcePreparation.releaseId;
 const body={kind:'ITERATION',title:'Successor data strategy',goal:{text:'Explicit successor protocol fixture, no live model.',attachmentIds:[]},baseAcceptedReleaseId:sourceReleaseId,clientDraftId:randomUUID()},bodyHash=await content(control.storage,body.goal.text),project=control.get('SELECT revision FROM projects WHERE project_id=?',control.p.projectId);
 const created=await control.call('createInputTask',{meta:meta(control.p.projectId),projectId:control.p.projectId,ifMatch:'"r'+project.revision+'"',bodyHash,body}),p=created.result;
 assert.equal(control.get('SELECT base_commit FROM user_tasks WHERE task_id=?',p.taskId).base_commit,control.candidate.manifest.codeCommit);
 const decisionId='decision_'+randomUUID().replaceAll('-','');let migrationRef;
 const candidateSource=await releaseFreezeFixture(t,{existing:{db:control.db,storage:control.storage,p},targetCommit:'d'.repeat(40),delivery:{mutateData(data){Object.assign(data,{strategy,initialData:strategy==='PRESERVE_MIGRATE'?null:initialData,sourceReleaseId,migrationRef:strategy==='PRESERVE_MIGRATE'?migrationRef:null,replacementDecisionId:strategy==='REPLACE'?decisionId:null});}},async beforeJob(f){
  if(strategy!=='PRESERVE_MIGRATE')return;
  const stored=await f.content.putJson(meta(p.runId),{kind:'content'},JSON.parse(copyPlan)),artifactId='artifact_'+randomUUID().replaceAll('-',''),row=f.get('SELECT * FROM content_objects WHERE content_hash=?',stored.expectedHash);
  // Artifact provenance is explicitly seeded; its canonical bytes and content
  // publication/ACK, original Runner output collection and migration are real.
  f.insert('artifacts',{artifact_id:artifactId,project_id:p.projectId,run_id:p.runId,attempt_id:null,kind:'migration-fixture',content_hash:stored.expectedHash,byte_size:row.byte_size,storage_key:row.storage_key,state:'READY',created_at:new Date().toISOString()});migrationRef={artifactId,sha256:stored.expectedHash};
  const output=f.extraOutputs.find(o=>o.path===f.q.policy.delivery.materials.find(m=>m.key==='data.plan').path),data=JSON.parse(output.bytes);data.migrationRef=migrationRef;output.bytes=Buffer.from(canonical(data));
 }}),candidate=await candidateSource.freeze(),who={principalId:'user_1',runId:p.runId,candidateId:candidate.candidateId};
 async function reviewOne(item,verdict='PASS'){
  const run=await control.call('getRun',{runId:p.runId});return control.call('recordCandidateReview',{meta:meta(p.runId),...Object.fromEntries(['runId','candidateId'].map(k=>[k,who[k]])),ifMatch:'"r'+run.resourceRevision+'"',manifestHash:candidate.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:item.result?.resultId??null,verdict,procedure:'Explicit successor protocol observation.',expected:item.expected,observed:'Controlled protocol fixture, not human product acceptance.',evidence:[]});
 }
 for(const item of (await control.call('getCandidateReview',who)).items)await reviewOne(item);
 const policyHash=control.get('SELECT policy_hash FROM acceptance_backend_policies WHERE project_id=? AND policy_json=?',p.projectId,canonical({...control.policy,runnerId:first.data.options.runnerId,backendRef:first.data.acceptanceOptions.backendRef})).policy_hash;
 const basis=()=>control.call('getCandidateAcceptanceBasis',{...who,policyHash}),request=async()=>{const b=await basis();return {meta:meta(p.runId),runId:p.runId,ifMatch:'"r'+b.resourceRevision+'"',...Object.fromEntries(['candidateId','candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash','policyHash'].map(k=>[k,b[k]]))};};
 const {principalId:_principal,...backendOptions}=first.options,originalDriver=first.retirementBackend.driver,backend=new RunnerAcceptancePreparationBackend(first.store,first.data.paths,first.data.acceptance,originalDriver,backendOptions),preparer=new AcceptancePreparer(control.storage,control.policy.backendPrincipalId,backend),originalAcquire=first.data.authority.acquire;
 first.data.authority.acquire=async(preparation,authorize)=>{
  const grant=await originalAcquire(preparation,authorize);if(!preparation.request.source)return grant;
  const g=control.get('SELECT * FROM preview_write_gates WHERE dataset_id=?',preparation.request.source.datasetId),closed=await control.call('closeAcceptanceSourceWriteGate',{principalId:control.policy.backendPrincipalId,operationId:preparation.operationId,requestHash:preparation.requestHash,expectedRevision:preparation.revision,expectedFence:g.fence});
  assert.equal(closed.current,true);Object.assign(grant.sourceFence,{closeOperationId:closed.gate.closeOperationId,closeRequestHash:closed.gate.closeRequestHash,gateFence:closed.gate.fence});first.data.authority.records.set(preparation.operationId,structuredClone(grant));return grant;
 };
 async function confirm(input){const value=input??await request(),{policyHash:_policy,...rest}=value;return control.call('recordAcceptanceReplacementDecision',{...rest,decisionId,confirmation:'REPLACE_ACCEPTED_DATA'});}
 const begin=input=>control.call('beginAcceptancePreparation',input),sourceBytes=()=>readFile(first.data.pathsFor(sourcePreparation).databasePath);
 async function commit(preparation){
  const ready=await preparer.advance(preparation.operationId);assert.equal(ready.state,'READY',JSON.stringify(ready));const current=await control.call('getAcceptancePreparation',{principalId:'user_1',operationId:preparation.operationId}),run=await control.call('getRun',{runId:p.runId}),q=current.request;
  const input={meta:meta(p.runId),runId:p.runId,ifMatch:'"r'+run.resourceRevision+'"',preparationOperationId:current.operationId,requestHash:current.requestHash,expectedPreparationRevision:current.revision,expectedObservationSequence:ready.sequence,proofHash:ready.proofHash,...Object.fromEntries(['candidateId','candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash'].map(k=>[k,q[k]])),confirmation:'ACCEPT_RELEASE'},acceptor=new ReleaseAcceptor(control.storage,candidateSource.content),receipt=await acceptor.accept(input);return {receipt,input,ready,preparation:current};
 }
 return {first,control,p,candidate,candidateSource,who,sourceTask,sourceReleaseId,sourcePreparation,decisionId,policyHash,basis,request,reviewOne,confirm,begin,backend,preparer,commit,sourceBytes};
}
