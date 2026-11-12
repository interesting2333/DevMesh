import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseFreezeFixture} from './fixtures/release-freeze.mjs';
import {meta,requirements,hash} from './fixtures/storage-data.mjs';
const subject=(f,c)=>({principalId:'user_1',runId:f.p.runId,candidateId:c.candidateId});
const review=(f,c)=>f.storage.request('getCandidateReview',subject(f,c));
async function request(f,c,item,overrides={}){
 const r=await f.storage.request('getRun',{runId:f.p.runId});
 return {meta:meta(f.p.runId),runId:f.p.runId,candidateId:c.candidateId,ifMatch:'"r'+r.resourceRevision+'"',manifestHash:c.manifestHash,itemId:item.itemId,itemHash:item.itemHash,previousResultId:item.result?.resultId??null,verdict:'PASS',procedure:'在准确候选上按该验收条目逐步执行。',expected:item.expected,observed:'实际观察与预期一致。',evidence:[],...overrides};
}
const record=(f,input)=>f.storage.request('recordCandidateReview',input);
test('review projects every requirement acceptance and stable human checks without accepting or rewriting quality',async t=>{
 const f=await releaseFreezeFixture(t,{human:true}),c=await f.freeze(),before=await f.storage.request('getRun',{runId:f.p.runId}),v=await review(f,c);
 assert.deepEqual(await review(f,c),v);assert.equal(v.humanStatus,'MISSING');assert.equal(v.canPrepareAcceptance,false);assert.equal(v.canRecord,true);assert.equal(v.automaticStatus,'PASS');
 const expected=requirements().requirements.flatMap(r=>r.acceptance.map(text=>({id:r.id,text}))),actual=v.items.filter(x=>x.kind==='requirement');assert.equal(actual.length,expected.length);for(const e of expected)assert.ok(actual.some(i=>i.requirementIds.includes(e.id)&&i.expected===e.text));
 assert.ok(v.items.some(i=>i.kind==='quality-human'));assert.ok(v.automaticChecks.every(c=>c.status==='PASS'||c.status==='NOT_APPLICABLE'));
 const originalQuality=f.get('SELECT evaluation_json FROM quality_verifications WHERE operation_id=?',f.bound.operationId).evaluation_json;
 for(const item of v.items){const input=await request(f,c,item);const saved=await record(f,input);assert.equal(saved.manifestHash,c.manifestHash);assert.equal(saved.principalId,'user_1');assert.equal(saved.item.itemId,item.itemId);assert.equal(saved.procedure,input.procedure);}
 const done=await review(f,c);assert.equal(done.humanStatus,'PASS');assert.equal(done.canPrepareAcceptance,true);assert.notEqual(done.reviewHash,v.reviewHash);assert.equal(done.qualification,'CURRENT');
 assert.equal(f.get('SELECT state FROM attempts WHERE attempt_id=?',f.attemptId).state,'VERIFYING');assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.get('SELECT accepted_release_id FROM projects').accepted_release_id,null);assert.equal(f.get('SELECT evaluation_json FROM quality_verifications WHERE operation_id=?',f.bound.operationId).evaluation_json,originalQuality);
 assert.equal((await f.storage.request('getRun',{runId:f.p.runId})).eventSeq,before.eventSeq+v.items.length);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('failed observations append corrections and original acknowledgement recovers exactly with paginated history',async t=>{
 const f=await releaseFreezeFixture(t),c=await f.freeze(),item=(await review(f,c)).items[0],input=await request(f,c,item,{verdict:'FAIL',observed:'实际行为与预期不一致。'}),a=await record(f,input);
 assert.equal((await review(f,c)).humanStatus,'FAIL');assert.deepEqual(await record(f,input),a);let current=(await review(f,c)).items.find(x=>x.itemId===item.itemId);
 const b=await record(f,await request(f,c,current));assert.notEqual(a.resultId,b.resultId);assert.equal(b.previousResultId,a.resultId);assert.deepEqual(await record(f,input),a);
 const first=await f.storage.request('listCandidateReviewHistory',{...subject(f,c),itemId:item.itemId,limit:1});assert.equal(first.items[0].result.verdict,'FAIL');assert.ok(first.nextSequence>0);
 const next=await f.storage.request('listCandidateReviewHistory',{...subject(f,c),itemId:item.itemId,afterSequence:first.nextSequence,limit:1});assert.equal(next.items[0].result.resultId,b.resultId);assert.equal(next.nextSequence,null);
 assert.throws(()=>f.run("UPDATE candidate_review_results SET verdict='PASS' WHERE result_id=?",a.resultId),/CANDIDATE_REVIEW_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM candidate_review_results WHERE result_id=?',a.resultId),/CANDIDATE_REVIEW_IMMUTABLE/);
});
test('standard version and item CAS reject concurrent overwrites, altered original keys and unknown checks',async t=>{
 const f=await releaseFreezeFixture(t),c=await f.freeze(),item=(await review(f,c)).items[0],a=await request(f,c,item),b=await request(f,c,item,{verdict:'FAIL'});await record(f,a);
 await assert.rejects(record(f,b),{code:'PRECONDITION_FAILED'});await assert.rejects(record(f,{...b,ifMatch:(await request(f,c,item)).ifMatch}),{code:'CANDIDATE_REVIEW_CONFLICT'});await assert.rejects(record(f,{...a,verdict:'FAIL'}),{code:'IDEMPOTENCY_KEY_REUSED'});
 for(const override of [{itemId:'unknown.item'},{itemHash:hash('wrong item')},{expected:'随意降低预期。'}])await assert.rejects(record(f,await request(f,c,item,override)));
 await assert.rejects(record(f,{...await request(f,c,item),verdict:'NOT_APPLICABLE'}),{code:'SCHEMA_INVALID'});assert.equal(f.get('SELECT count(*) n FROM candidate_review_results').n,1);
});
test('new candidate requires fresh review while stale history and original replay retain the old observations',async t=>{
 const f=await releaseFreezeFixture(t),a=await f.freeze(),input=await request(f,a,(await review(f,a)).items[0]),result=await record(f,input),b=await f.freeze();
 const old=await review(f,a),fresh=await review(f,b);assert.equal(old.qualification,'STALE');assert.equal(old.humanStatus,'STALE');assert.equal(old.canRecord,false);assert.equal(fresh.humanStatus,'MISSING');assert.ok(fresh.items.every(i=>i.result===null));assert.notEqual(old.items[0].itemId,fresh.items[0].itemId);
 await assert.rejects(record(f,await request(f,a,old.items[0])),{code:'CANDIDATE_REVIEW_STALE'});assert.deepEqual(await record(f,input),result);await f.sourceSnapshot();assert.equal((await review(f,b)).qualification,'STALE');
});
test('owner writes, members read, cross-project and revoked original replay cannot expose protected review',async t=>{
 const f=await releaseFreezeFixture(t),c=await f.freeze(),item=(await review(f,c)).items[0],input=await request(f,c,item);await record(f,input);
 for(const role of ['viewer','operator']){const principalId='review.'+role;f.insert('project_members',{project_id:f.p.projectId,principal_id:principalId,role,created_at:new Date().toISOString()});const v=await f.storage.request('getCandidateReview',{...subject(f,c),principalId});assert.equal(v.canRecord,false);await assert.rejects(record(f,{...await request(f,c,item),meta:{...meta(f.p.runId),principalId}}),{code:'FORBIDDEN'});}
 await assert.rejects(f.storage.request('getCandidateReview',{...subject(f,c),principalId:'external.service'}));f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');await assert.rejects(record(f,input));await assert.rejects(review(f,c));
});
test('review evidence is exact same Run content and immutable links pin original bytes against GC',async t=>{
 const f=await releaseFreezeFixture(t),c=await f.freeze(),item=(await review(f,c)).items[0],ref=c.manifest.works[0].evidence,input=await request(f,c,item,{evidence:[ref]}),a=await record(f,input);
 assert.equal(f.get('SELECT content_hash FROM candidate_review_evidence WHERE result_id=?',a.resultId).content_hash,ref.sha256);await assert.rejects(f.storage.request('beginContentDeletion',{contentHash:ref.sha256}),{code:'CONTENT_REFERENCED'});
 const latest=(await review(f,c)).items.find(x=>x.itemId===item.itemId);await assert.rejects(record(f,await request(f,c,latest,{evidence:[{...ref,sha256:hash('wrong bytes')}]})),{code:'CANDIDATE_REVIEW_EVIDENCE_INVALID'});
 await assert.rejects(record(f,await request(f,c,latest,{evidence:[ref,ref]})),{code:'CANDIDATE_REVIEW_EVIDENCE_INVALID'});
 await f.storage.request('markContentMissing',{contentHash:ref.sha256,error:'explicit missing original bytes'});assert.equal((await review(f,c)).humanStatus,'STALE');assert.deepEqual(await record(f,input),a);
});
test('result, evidence, current pointer, operation and event roll back together then original key is safe',async t=>{
 const f=await releaseFreezeFixture(t),c=await f.freeze(),item=(await review(f,c)).items[0],input=await request(f,c,item,{evidence:[c.manifest.works[0].evidence]}),before=await f.storage.request('getRun',{runId:f.p.runId});
 f.db.exec("CREATE TRIGGER cut_review BEFORE INSERT ON candidate_review_current BEGIN SELECT RAISE(ABORT,'review-cut'); END");await assert.rejects(record(f,input),/review-cut/);assert.equal(f.get('SELECT count(*) n FROM candidate_review_results').n,0);assert.equal(f.get('SELECT count(*) n FROM candidate_review_evidence').n,0);assert.deepEqual(await f.storage.request('getRun',{runId:f.p.runId}),before);assert.equal(await f.storage.request('lookupOperation',input.meta),null);
 f.db.exec('DROP TRIGGER cut_review');const original=f.storage.request.bind(f.storage);let lost=true;f.storage.request=async(method,args)=>{const value=await original(method,args);if(method==='recordCandidateReview'&&lost){lost=false;throw Error('lost review acknowledgement');}return value;};await assert.rejects(record(f,input),/lost review acknowledgement/);const saved=await record(f,input);assert.equal(f.get('SELECT count(*) n FROM candidate_review_results').n,1);assert.equal((await f.storage.request('getRun',{runId:f.p.runId})).eventSeq,before.eventSeq+1);assert.equal(saved.verdict,'PASS');
});
