import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {workbenchPlanningFixture} from './fixtures/workbench-planning.mjs';
import {meta} from './fixtures/storage-data.mjs';
const source=(f,ref,runId=f.runId,headers)=>f.call('/runs/'+runId+'/sources?ref='+encodeURIComponent(JSON.stringify(ref)),undefined,headers);

test('source GET reads actual A2A preparation message, cited Git bytes and exact requirement without business writes',{timeout:180000},async t=>{
 const f=await workbenchPlanningFixture(t);assert.equal(f.calls.length,2);assert.equal(f.review.canConfirm,true,JSON.stringify(f.review));const before=(await f.storage.request('inspect',{})).counts,pins=new Set(f.sql('SELECT pin_id FROM storage_pins').map(p=>p.pin_id));
 const m=await source(f,f.ref);assert.equal(m.response.status,200,JSON.stringify(m.body));assert(m.body.body.text.includes('<script>window.untrusted=1</script>'));assert.deepEqual(m.body.ref,f.ref);assert.equal(m.response.headers.get('cache-control'),'no-store');
 const a=await source(f,f.gitRef);assert.equal(a.response.status,200,JSON.stringify(a.body));assert.equal(JSON.parse(a.body.body.text).templateId,'web-crud-v1');assert.deepEqual(a.body.ref,f.gitRef);assert(!JSON.stringify(a.body).includes(f.local.dataRoot));
 const r=await source(f,{kind:'requirement',requirementId:'requirement_1',requirementRevision:1});assert.equal(r.response.status,200);assert.equal(r.body.body.requirement.statement,f.product.requirements[0].statement);
 const after=(await f.storage.request('inspect',{})).counts,newPins=f.sql('SELECT * FROM storage_pins').filter(p=>!pins.has(p.pin_id));assert.equal(after.storage_pins-before.storage_pins,2);assert.equal(newPins.length,2);for(const pin of newPins){assert.equal(pin.owner_type,'READ');assert.equal(pin.state,'RELEASED');}const businessCounts=counts=>Object.fromEntries(Object.entries(counts).filter(([key])=>key!=='storage_pins'));assert.deepEqual(businessCounts(after),businessCounts(before));
 const draft=structuredClone(f.draft);draft.requirementRevision=2;const requirements={schemaVersion:'devmesh.requirements.v1',role:'product',requirements:[{...f.product.requirements[0],statement:'第二版本的明确需求'}],assumptions:[],questions:[]},p=await f.content.putJson(meta(f.runId),{kind:'content'},draft);
 await f.storage.request('publishPlan',{meta:meta(f.runId),runId:f.runId,ifMatch:'"r'+f.workspace.run.resourceRevision+'"',requirementRevision:2,planRevision:2,requirements,plan:draft,planContentHash:p.expectedHash});
 assert.equal((await source(f,{kind:'requirement',requirementId:'requirement_1',requirementRevision:1})).body.body.requirement.statement,f.product.requirements[0].statement);assert.equal((await source(f,{kind:'requirement',requirementId:'requirement_1',requirementRevision:2})).body.body.requirement.statement,'第二版本的明确需求');assert.equal((await source(f,{kind:'requirement',requirementId:'requirement_missing',requirementRevision:1})).response.status,404);
});

test('source resolution rejects cross-Run, uncited internal artifact, wrong hash, malformed reference and foreign member',{timeout:180000},async t=>{
 const f=await workbenchPlanningFixture(t),[internal]=f.sql('SELECT a.artifact_id,a.content_hash FROM input_messages m JOIN artifacts a ON a.artifact_id=m.body_artifact_id WHERE m.message_id=?',f.messageId);
 assert.equal((await source(f,{kind:'artifact',artifactId:internal.artifact_id,sha256:internal.content_hash})).response.status,404);assert.equal((await source(f,{...f.gitRef,sha256:'f'.repeat(64)})).response.status,404);
 const foreign=await f.call('/projects',{name:'另一项目',initialRequest:{text:'外国源',attachmentIds:[]},clientDraftId:randomUUID()});assert.equal(foreign.response.status,201);assert.equal((await source(f,{kind:'message',messageId:foreign.body.result.messageId})).response.status,404);assert.equal((await source(f,f.gitRef,foreign.body.result.runId)).response.status,404);assert.equal((await source(f,f.gitRef,f.runId,{authorization:'Bearer user_other'})).response.status,404);
 for(const query of ['ref=not-json','ref='+encodeURIComponent(JSON.stringify({...f.ref,path:'../../secrets'})),'ref=%7B%7D','ref='+encodeURIComponent(JSON.stringify(f.ref))+'&ref=%7B%7D'])assert.equal((await f.call('/runs/'+f.runId+'/sources?'+query)).response.status,422);
 f.sql('INSERT INTO project_members(project_id,principal_id,role,created_at) VALUES(?,?,?,?)',f.projectId,'viewer_1','viewer',new Date().toISOString());assert.equal((await source(f,f.gitRef,f.runId,{authorization:'Bearer viewer_1'})).response.status,200);
});

test('source hash and membership are checked again after asynchronous file read',{timeout:180000},async t=>{
 const f=await workbenchPlanningFixture(t),read=f.content.readBytes.bind(f.content);let mode='hash',reads=0;
 f.content.readBytes=async(...args)=>{reads++;const bytes=await read(...args);if(mode==='hash')return new TextEncoder().encode('different source');if(mode==='revoke')f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.projectId,'user_1');return bytes;};
 const changed=await source(f,f.gitRef);assert.equal(changed.response.status,409);assert.equal(changed.body.error.code,'CONTENT_CORRUPT');assert.equal(reads,1);
 mode='revoke';const revoked=await source(f,f.gitRef);assert.equal(revoked.response.status,404);assert(!JSON.stringify(revoked.body).includes('templateId'));assert.equal(reads,2);assert.equal(f.sql('SELECT count(*) n FROM plan_confirmations')[0].n,0);assert.equal(f.sql('SELECT count(*) n FROM attempts')[0].n,0);
});

test('inline source refuses actual invalid UTF-8 and oversized original content',{timeout:180000},async t=>{
 const f=await workbenchPlanningFixture(t),clientMessageId=randomUUID(),saved=await f.call('/runs/'+f.runId+'/messages',{text:'为读取边界建立新来源依据',attachmentIds:[],clientMessageId},{'if-match':'"r'+f.workspace.run.resourceRevision+'"'});assert.equal(saved.response.status,202);
 const [processing]=f.sql('SELECT p.operation_id FROM input_processing p JOIN input_messages m ON m.message_id=p.message_id WHERE m.run_id=? AND m.client_message_id=?',f.runId,clientMessageId),job=await f.storage.request('ensurePreparationJob',{principalId:'user_1',runId:f.runId,processingOperationId:processing.operation_id});
 // Explicit trusted bootstrap-content fixtures verify read boundaries. These
 // bytes are not claimed as a real Git/model result or production input file.
 const refs=[];for(const [path,bytes]of [['binary-source.bin',Uint8Array.of(255,254)],['large-source.txt',Buffer.alloc(2*1024*1024+1,97)]]){const object=await f.content.putBytes(meta(f.runId),{kind:'content'},bytes),ref=await f.storage.request('registerPreparationBootstrap',{principalId:'user_1',jobId:job.jobId,path,contentHash:object.expectedHash});refs.push({kind:'artifact',...ref});}
 const draft=structuredClone(f.draft);draft.requirementRevision=2;const req={schemaVersion:'devmesh.requirements.v1',role:'product',requirements:[{...f.product.requirements[0],sourceRefs:refs}],assumptions:[],questions:[]},object=await f.content.putJson(meta(f.runId),{kind:'content'},draft);await f.storage.request('publishPlan',{meta:meta(f.runId),runId:f.runId,ifMatch:'"r'+saved.body.resource.revision+'"',requirementRevision:2,planRevision:2,requirements:req,plan:draft,planContentHash:object.expectedHash});
 assert.equal((await source(f,refs[0])).response.status,415);assert.equal((await source(f,refs[1])).response.status,413);
});
