import test from 'node:test';
import assert from 'node:assert/strict';
import {workbenchDeliveryFixture} from './fixtures/workbench-delivery.mjs';
import {inputFixture} from './fixtures/input-data.mjs';
import {workbenchDeliveryView} from '../packages/contracts/dist/index.js';

test('delivery reads actual exact freezes, bounded pages and explicitly selected old candidates without business writes',{timeout:360000},async t=>{
 const f=await workbenchDeliveryFixture(t),first=f.candidate,second=await f.freeze(),third=await f.freeze(),before=f.snapshot(),a=workbenchDeliveryView.parse(await f.delivery(f.path+'?limit=2&selectedCandidateId='+first.candidateId));
 assert.deepEqual(a.candidates.map(c=>c.candidateId),[first.candidateId,second.candidateId]);assert.equal(a.nextRevision,second.revision);assert.equal(a.selectedCandidate.candidateId,first.candidateId);assert.equal(a.selectedCandidate.qualification,'STALE');assert.equal(a.acceptedRelease,null);assert.equal('manifest'in a.candidates[0],false);
 const b=await f.delivery(f.path+'?limit=2&afterRevision='+a.nextRevision+'&selectedCandidateId='+first.candidateId);assert.deepEqual(b.candidates.map(c=>c.candidateId),[third.candidateId]);assert.equal(b.nextRevision,null);assert.equal(b.selectedCandidate.candidateId,first.candidateId);assert.equal(b.candidates[0].qualification,'CURRENT');assert.equal(f.snapshot(),before);
 for(const q of ['limit=21','limit=0','afterRevision=-1','afterRevision=9007199254740992','unexpected=1','selectedCandidateId='+first.candidateId+'&selectedCandidateId='+second.candidateId])assert.equal((await f.get(f.path+'?'+q)).status,422,q);
 assert.equal((await f.get(f.path+'?selectedCandidateId=candidate_not_here')).status,404);assert.equal((await f.get(f.path,{authorization:'Bearer fixture_other'})).status,404);assert.equal((await fetch(f.origin+f.path)).status,401);
});

test('empty delivery belongs to the protected project and Run, with no inferred or foreign candidate',{timeout:180000},async t=>{
 const f=await inputFixture(t),a=(await f.create({name:'A'})).body.result,b=(await f.create({name:'B'})).body.result,path='/projects/'+a.projectId+'/runs/'+a.runId+'/delivery',before=(await f.storage.request('inspect',{})).counts,read=await f.call(path);assert.equal(read.response.status,200,JSON.stringify(read.body));assert.deepEqual(read.body.candidates,[]);assert.equal(read.body.selectedCandidate,null);assert.equal(read.body.acceptedRelease,null);
 assert.equal((await f.call(path.replace(a.runId,b.runId))).response.status,404);assert.equal((await f.call(path,{headers:{authorization:'Bearer test_other'}})).response.status,404);assert.deepEqual((await f.storage.request('inspect',{})).counts,before);
});

test('delivery rejects a changed final basis and revocation after asynchronous candidate reads',{timeout:180000},async t=>{
 const f=await workbenchDeliveryFixture(t);f.fault.after='listReleaseCandidates';f.fault.action=()=>f.run('UPDATE runs SET resource_revision=resource_revision+1 WHERE run_id=?',f.p.runId);const moved=await f.get();assert.equal(moved.status,409);assert.equal((await moved.json()).error.code,'BASIS_SUPERSEDED');
 f.fault.after='listReleaseCandidates';f.fault.action=()=>f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');const revoked=await f.get();assert.equal(revoked.status,404);assert.equal((await revoked.json()).error.code,'RESOURCE_NOT_FOUND');
});

test('viewer and historical reads preserve exact candidate and a separate accepted release from its original Run',{timeout:240000},async t=>{
 const f=await workbenchDeliveryFixture(t,{accepted:true}),old=f.p,next=await f.nextTask(),path='/api/v1/projects/'+old.projectId+'/runs/'+next.runId+'/delivery',before=f.snapshot(),current=await f.delivery(path);assert.equal(current.runId,next.runId);assert.equal(current.mode,'current');assert.deepEqual(current.candidates,[]);assert.equal(current.acceptedRelease.releaseId,f.publication.releaseId);assert.equal(current.acceptedRelease.runId,old.runId);assert.equal(current.acceptedRelease.candidateId,f.candidate.candidateId);
 const history=await f.delivery();assert.equal(history.mode,'history');assert.equal(history.candidates[0].candidateId,f.candidate.candidateId);assert.equal((await f.get(path+'?selectedCandidateId='+f.candidate.candidateId)).status,404);assert.equal(f.snapshot(),before);
 f.run('INSERT INTO project_members VALUES(?,?,?,?)',old.projectId,'delivery.viewer','viewer',new Date().toISOString());const viewer=await f.get(path,{authorization:'Bearer fixture_viewer'});assert.equal(viewer.status,200);assert.equal((await viewer.json()).membership,'viewer');
 for(const target of ['/api/v1/runs/'+old.runId+'/releases/'+f.publication.releaseId+'/view','/api/v1/releases/'+f.publication.releaseId+'/exports/view']){const response=await f.get(target),html=await response.text();assert.equal(response.status,200);assert(html.includes('id="workbench-return"'));assert(html.includes('runId='+old.runId));assert.equal((await f.get(target+'?returnUrl=https://elsewhere.invalid')).status,422);}
});
