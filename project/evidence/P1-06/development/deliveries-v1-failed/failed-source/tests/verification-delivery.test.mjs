import test from 'node:test';
import assert from 'node:assert/strict';
import {DeliveryCollector} from '../packages/result-verifier/dist/index.mjs';
import {qualityRunnerFixture} from './fixtures/quality-runner.mjs';
import {qualityStorageFixture} from './fixtures/quality-storage.mjs';
import {deliveryOptions,deliveryProfile} from './fixtures/delivery.mjs';
import {hash} from './fixtures/storage-data.mjs';

async function policy(f,profile=f.q.policy.delivery){return f.storage.request('registerReleaseDeliveryPolicy',{principalId:'user_1',projectId:f.p.projectId,policy:{schemaVersion:'devmesh.delivery-policy.v1',templateVersion:f.q.policy.templateVersion,checkConfigHash:f.policy.configHash,...profile}});}
async function fixture(t,options={}){
 const f=await qualityRunnerFixture(t,{...deliveryOptions(options),...options}),registered=await policy(f),input={principalId:'user_1',operationId:'op_delivery',runId:f.p.runId,qualityOperationId:f.bound.operationId,policyHash:registered.policyHash};
 await f.prepare();const job=await f.runJob();const result=await f.collector.collect(f.subject);assert.equal(result.verification.evaluation.automaticStatus,'PASS');
 return {...f,input,job,delivery:new DeliveryCollector(f.storage,f.content,f.runner),readDelivery:()=>f.storage.request('getReleaseDelivery',{principalId:'user_1',operationId:input.operationId})};
}
const subject=f=>({principalId:'user_1',operationId:f.input.operationId});
test('original authenticated Job outputs become immutable delivery without another Job, process or accepted Release',async t=>{
 const f=await fixture(t,{large:true}),native=globalThis.fetch,methods=[];globalThis.fetch=async(url,init)=>{methods.push(init?.method??'GET');return native(url,init);};let result;
 try{result=await f.delivery.collect(f.input);}finally{globalThis.fetch=native;}
 assert.equal(result.state,'READY');assert.equal(result.qualification,'CURRENT');assert.equal(result.image.targetCommit,f.q.input.scope.targetCommit);assert.notEqual(result.image.imageDigest,f.job.request.imageDigest.split('@')[1]);assert.equal(result.dataPlan.strategy,'INITIAL');
 const raw=f.get('SELECT job_json FROM pipeline_stages WHERE pipeline_id=?',f.pipelineId).job_json;assert.equal(result.basis.jobHash,hash(raw));
 assert.ok(methods.length>1);assert.equal(methods.includes('POST'),false);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);assert.equal(f.get('SELECT count(*) n FROM release_candidates').n,0);
 const rows=await f.storage.request('listReleaseDeliveryMaterials',subject(f));assert.equal(rows.length,8);assert.ok(rows.every(r=>r.contentHash===r.expectedHash&&r.writeId));for(const row of rows){const expected=f.extraOutputs.find(r=>r.path===row.path).bytes;assert.deepEqual(Buffer.from(await f.content.readBytes('user_1',{kind:'releaseDelivery',operationId:f.input.operationId,materialKey:row.materialKey},64*1024*1024)),expected);}
 const offline=new DeliveryCollector(f.storage,f.content);assert.deepEqual(await offline.collect(f.input),result);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('delivery policy must have been pinned before Tester admission and cannot be weakened after quality PASS',async t=>{
 const legacy=await qualityStorageFixture(t);await legacy.prepareResult();await legacy.complete();await assert.rejects(policy(legacy,deliveryProfile),{code:'RELEASE_DELIVERY_POLICY_CHANGED'});
 const f=await fixture(t),changed=structuredClone(deliveryProfile);changed.materials[0].path='.artifacts/other.bin';await assert.rejects(policy(f,changed),{code:'RELEASE_DELIVERY_POLICY_CHANGED'});const noLayers=structuredClone(deliveryProfile);noLayers.materials.pop();await assert.rejects(policy(f,noLayers));assert.equal(f.get('SELECT count(*) n FROM release_deliveries').n,0);
});
test('lost material and final ACKs recover the original operation with no additional Runner execution',async t=>{
 const f=await fixture(t);let lostContent=false,lostFinal=false;const proxy={request:async(method,input)=>{const r=await f.storage.request(method,input);if(method==='commitObjectWrite'&&!lostContent){lostContent=true;throw Object.assign(Error('lost material ACK'),{code:'OUTCOME_UNKNOWN'});}if(method==='completeReleaseDelivery'&&!lostFinal){lostFinal=true;throw Object.assign(Error('lost final ACK'),{code:'OUTCOME_UNKNOWN'});}return r;}},saved=f.content.storage;f.content.storage=proxy;
 try{const collector=new DeliveryCollector(proxy,f.content,f.runner);await assert.rejects(collector.collect(f.input),{code:'OUTCOME_UNKNOWN'});assert.equal((await f.readDelivery()).state,'PREPARED');assert.equal((await f.storage.request('listReleaseDeliveryMaterials',subject(f))).filter(r=>r.contentHash).length,1);await assert.rejects(collector.collect(f.input),{code:'OUTCOME_UNKNOWN'});assert.equal((await f.readDelivery()).state,'READY');const writes=f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='releaseDelivery'").n;assert.equal(writes,8);assert.equal((await new DeliveryCollector(proxy,f.content).collect(f.input)).state,'READY');assert.equal(f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='releaseDelivery'").n,writes);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);}finally{f.content.storage=saved;}
});
test('changed original Job identity and corrupted HTTP bytes never complete delivery',async t=>{
 const f=await fixture(t),changed={get:async()=>({...f.job,requestHash:hash('different-request')}),output(){throw Error('must not read changed origin');}};await assert.rejects(new DeliveryCollector(f.storage,f.content,changed).collect(f.input),{code:'DELIVERY_ORIGIN_FACT_CHANGED'});
 const native=globalThis.fetch,index=f.job.request.outputSpec.indexOf(deliveryProfile.materials[0].path)+1;globalThis.fetch=async(url,init)=>{const response=await native(url,init);if(String(url).endsWith('/outputs/'+index)){const b=new Uint8Array(await response.arrayBuffer());b[0]^=1;return new Response(b,{status:response.status,headers:response.headers});}return response;};try{await assert.rejects(f.delivery.collect(f.input),{code:'RUNNER_OUTPUT_CORRUPT'});}finally{globalThis.fetch=native;}
 assert.equal((await f.readDelivery()).state,'PREPARED');assert.equal((await f.storage.request('listReleaseDeliveryMaterials',subject(f))).some(r=>r.contentHash),false);assert.equal((await f.delivery.collect(f.input)).state,'READY');
});
test('canonical data plan must bind exact Run, revisions, commit and existing data lineage',async t=>{
 for(const options of [{mutateData:d=>{d.codeCommit='e'.repeat(40);}},{mutateData:d=>{d.requirementRevision++;}},{prettyData:true}]){const f=await fixture(t,options);await assert.rejects(f.delivery.collect(f.input),{code:options.prettyData?'DELIVERY_DATA_PLAN_CANONICAL_REQUIRED':'DELIVERY_DATA_PLAN_CHANGED'});assert.equal((await f.readDelivery()).state,'PREPARED');assert.equal(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId).accepted_release_id,null);}
});
test('missing fixed output and unconfigured Runner are explicit failures',async t=>{
 const f=await fixture(t);await assert.rejects(new DeliveryCollector(f.storage,f.content).collect(f.input),{code:'DELIVERY_RUNNER_NOT_CONFIGURED'});assert.equal((await f.readDelivery()).state,'PREPARED');
 const g=await fixture(t,{missingPath:deliveryProfile.materials[0].path});await assert.rejects(g.delivery.collect(g.input),{code:'RELEASE_DELIVERY_MATERIAL_MISSING'});assert.equal(g.get('SELECT count(*) n FROM release_deliveries').n,0);
});
test('delivery is owner-written, membership-rechecked on replay and protected from content GC',async t=>{
 const f=await fixture(t),result=await f.delivery.collect(f.input),rows=await f.storage.request('listReleaseDeliveryMaterials',subject(f));
 f.run('INSERT INTO project_members VALUES(?,?,?)',f.p.projectId,'user_member','member');assert.equal((await f.storage.request('getReleaseDelivery',{principalId:'user_member',operationId:f.input.operationId})).state,'READY');await assert.rejects(f.storage.request('beginReleaseDelivery',{...f.input,principalId:'user_member'}),{code:'RELEASE_DELIVERY_NOT_FOUND'});
 await assert.rejects(f.storage.request('beginContentDelete',{contentHash:rows[0].contentHash}),{code:'CONTENT_REFERENCED'});assert.throws(()=>f.run("UPDATE release_delivery_materials SET expected_hash=? WHERE operation_id=?",hash('replacement'),f.input.operationId),/DELIVERY_MATERIAL_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM release_deliveries WHERE operation_id=?',f.input.operationId),/RELEASE_DELIVERY_IMMUTABLE/);
 await assert.rejects(f.storage.request('completeReleaseDelivery',{...subject(f),requestHash:result.requestHash,image:{...result.image,targetCommit:'e'.repeat(40)},dataPlan:result.dataPlan}),{code:'RELEASE_DELIVERY_IMMUTABLE'});
 f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');await assert.rejects(f.delivery.collect(f.input),{code:'RELEASE_DELIVERY_NOT_FOUND'});
});
