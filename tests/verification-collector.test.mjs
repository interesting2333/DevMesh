import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {QualityCollector} from '../packages/result-verifier/dist/index.mjs';
import {RunnerClient,RunnerManager,RunnerPolicy,RunnerMaterials,serveRunner} from '../packages/runner/dist/index.mjs';
import {PipelineCoordinator} from '../packages/mcp-tools/dist/index.mjs';
import {qualityStorageFixture} from './fixtures/quality-storage.mjs';
import {fixture as runnerFixture,until} from './fixtures/runner.mjs';
import {canonical,hash} from './fixtures/storage-data.mjs';

// Source/A2A admission are explicit DB fixtures, including an independently
// constructed map. Runner Job persistence, authenticated HTTP, output files,
// coordinator receipts and content publication below are real local components.
async function fixture(t,options={}){
 const f=await qualityStorageFixture(t,{pending:true,unprepared:true,runnerId:'runner.test',failed:options.failed}),r=await runnerFixture(t),path='workspaces/'+f.attemptId,workspace=join(r.layout.dataRoot,path);await mkdir(workspace,{recursive:true});
 const policy=new RunnerPolicy({...r.policy.config,imageDigests:[f.q.policy.producers[0].imageDigest],commands:{unit:f.q.policy.producers[0].command},workspaces:{[f.workspaceRef]:{attemptId:f.attemptId,ownerKind:'workflowAttempt',resourceId:f.workspaceRef,relativePath:path}}});
 const manager=new RunnerManager(r.layout.store,policy,r.backend,r.authority,new RunnerMaterials(r.layout.dataRoot),{pollIntervalMs:600000});r.cleanup.push(()=>manager.close());
 const backendStart=r.backend.start.bind(r.backend);r.backend.start=async(...args)=>{for(const report of f.q.reports){const target=join(workspace,report.report.outputPath);await mkdir(dirname(target),{recursive:true});await writeFile(target,report.bytes);}return backendStart(...args);};
 const secret='quality-original-output-local-test',http=await serveRunner(manager,{identities:[{controllerId:'controller.local',credentialRef:'runner'}],credentials:async()=>secret});r.cleanup.push(()=>http.close());await manager.start();
 const runner=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner',async()=>secret),coordinator=new PipelineCoordinator(f.storage,runner);let prepared=0;
 const source={providerId:'explicit-independent-map-fixture',toolchainHash:hash('fixture-only-not-production-instrumentation'),async prepare(){prepared++;return structuredClone(f.q.input.scope);}},collector=new QualityCollector(f.storage,f.content,runner,source),subject={principalId:'user_1',operationId:f.bound.operationId};
 async function prepare(){await collector.prepare(f.begin);await collector.bind(subject,{producerId:'front',pipelineId:f.pipelineId,ordinal:0});}
 function sent(){const request={schemaVersion:'devmesh.runner-job.v1',operationId:f.execution.operationId,permit:JSON.parse(f.grant.permit_json),imageDigest:f.q.policy.producers[0].imageDigest,workspaceRef:f.workspaceRef,commandSpec:{kind:'unit'},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:10000},networkPolicyRef:'none',outputSpec:f.q.policy.reports.map(r=>r.path)};
  f.run("UPDATE pipeline_stages SET state='SENT',request_json=? WHERE pipeline_id=?",canonical(request),f.pipelineId);return request;}
 async function runJob(){const request=sent(),job=await runner.start(request),dispatch={pipelineId:f.pipelineId,ordinal:0,operationId:request.operationId,state:'SENT',jobId:null,stopRequested:false,request};await coordinator.process(dispatch);await manager.tick();await until(async()=>(await runner.get(job.jobId)).state==='RUNNING');const fact=r.backend.facts.get(job.jobId);r.backend.facts.set(job.jobId,{...fact,state:'exited',pid:0,exitCode:options.failed?1:0,finishedAt:new Date().toISOString()});await manager.tick();await until(async()=>(await runner.get(job.jobId)).state==='EXITED');await coordinator.process({...dispatch,state:'ACKED',jobId:job.jobId});return runner.get(job.jobId);}
 return {...f,r,runner,manager,coordinator,collector,subject,source,prepare,sent,runJob,prepared:()=>prepared};
}
test('collector pins source before dispatch and retains original authenticated Runner reports without starting another Job',async t=>{
 const f=await fixture(t);await assert.rejects(f.storage.request('markPipelineStageSent',{pipelineId:f.pipelineId,ordinal:0}),{code:'QUALITY_SOURCE_NOT_PREPARED'});await f.collector.prepare(f.begin);await assert.rejects(f.storage.request('markPipelineStageSent',{pipelineId:f.pipelineId,ordinal:0}),{code:'QUALITY_STAGE_BINDING_INVALID'});await f.prepare();const source=f.get("SELECT * FROM quality_materials WHERE material_key='source'");assert.ok(source.content_hash);const job=await f.runJob(),native=globalThis.fetch,methods=[];
 globalThis.fetch=async(url,init)=>{methods.push(init?.method??'GET');return native(url,init);};let result;try{result=await f.collector.collect(f.subject);}finally{globalThis.fetch=native;}
 assert.equal(result.state,'EVALUATED');assert.equal(result.verification.evaluation.automaticStatus,'PASS');assert.equal(methods.includes('POST'),false);assert.equal(f.prepared(),1);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);assert.deepEqual(result.verification.origins.map(o=>o.execution.jobId),[job.jobId]);
 for(const report of f.q.reports){const bytes=await f.content.readBytes('user_1',{kind:'qualityMaterial',operationId:f.bound.operationId,materialKey:'report.'+report.report.reportId});assert.deepEqual(Buffer.from(bytes),report.bytes);}
 const logs=await f.content.readBytes('user_1',{kind:'qualityMaterial',operationId:f.bound.operationId,materialKey:'log.front'});assert.equal(Buffer.from(logs).toString(),'controlled backend log\n');assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 await f.collector.prepare(f.begin);assert.equal(f.prepared(),1);const offline=new QualityCollector(f.storage,f.content,{get(){throw Error('must not query completed Job');},byOperation(){throw Error('must not resend');},output(){throw Error('must not fetch retained bytes');}});assert.deepEqual(await offline.collect(f.subject),result);
});
test('actual failed Job and raw failed assertion remain findings rather than a passing verification',async t=>{
 const f=await fixture(t,{failed:true});await f.prepare();const job=await f.runJob(),result=await f.collector.collect(f.subject);assert.equal(job.exitCode,1);assert.equal(result.state,'EVALUATED');assert.equal(result.verification.evaluation.automaticStatus,'FAIL');assert.equal(result.verification.evaluation.checks.find(c=>c.tests).tests.failed,1);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);
});
test('unknown original stage is queried by its original operation and never resubmitted',async t=>{
 const f=await fixture(t);await f.prepare();f.sent();const native=globalThis.fetch,methods=[];globalThis.fetch=async(url,init)=>{methods.push(init?.method??'GET');return native(url,init);};try{for(let n=0;n<2;n++){const result=await f.collector.collect(f.subject);assert.equal(result.state,'PENDING');assert.ok(result.codes.includes('JOB_NOT_FOUND'));}}finally{globalThis.fetch=native;}
 assert.equal(methods.length,2);assert.equal(methods.includes('POST'),false);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,0);assert.equal(f.get('SELECT count(*) n FROM quality_origins').n,0);assert.equal((await f.read()).evaluation,null);
});
test('lost content and final verification ACKs recover original writes and result with no Runner rerun',async t=>{
 const f=await fixture(t);await f.prepare();await f.runJob();let lostContent=false,lostFinal=false;
 const proxy={request:async(method,input)=>{const result=await f.storage.request(method,input);if(method==='commitObjectWrite'&&!lostContent){lostContent=true;throw Object.assign(Error('lost content ACK'),{code:'OUTCOME_UNKNOWN'});}if(method==='completeQualityVerification'&&!lostFinal){lostFinal=true;throw Object.assign(Error('lost final ACK'),{code:'OUTCOME_UNKNOWN'});}return result;}},content=f.content;
 const saved=content.storage;content.storage=proxy;const first=new QualityCollector(proxy,content,f.runner);
 try{const pending=await first.collect(f.subject);assert.equal(pending.state,'PENDING');assert.ok(pending.codes.includes('OUTCOME_UNKNOWN'));const writes=f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='qualityMaterial'").n;await assert.rejects(first.collect(f.subject),{code:'OUTCOME_UNKNOWN'});assert.equal((await f.read()).state,'EVALUATED');const terminalWrites=f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='qualityMaterial'").n;assert.ok(terminalWrites>writes);const recovered=await new QualityCollector(proxy,content,{get(){throw Error('offline');},byOperation(){throw Error('offline');},output(){throw Error('offline');}}).collect(f.subject);assert.equal(recovered.state,'EVALUATED');assert.equal(f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='qualityMaterial'").n,terminalWrites);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);}finally{content.storage=saved;}
});
test('HTTP bytes that disagree with the original output hash cannot become a quality result',async t=>{
 const f=await fixture(t);await f.prepare();await f.runJob();const native=globalThis.fetch;let corrupted=false;
 globalThis.fetch=async(url,init)=>{const response=await native(url,init);if(String(url).endsWith('/outputs/1')){corrupted=true;const bytes=new Uint8Array(await response.arrayBuffer());bytes[0]^=1;return new Response(bytes,{status:response.status,headers:response.headers});}return response;};
 try{const result=await f.collector.collect(f.subject);assert.equal(result.state,'PENDING');assert.ok(result.codes.includes('RUNNER_OUTPUT_CORRUPT'));}finally{globalThis.fetch=native;}
 assert.equal(corrupted,true);assert.equal((await f.read()).evaluation,null);assert.equal(f.get("SELECT 1 FROM quality_materials WHERE material_key='report.coverage.front'"),undefined);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);assert.equal((await f.collector.collect(f.subject)).verification.evaluation.automaticStatus,'PASS');
});
test('source provider is explicit and immutable stage binding cannot be replaced after original dispatch',async t=>{
 const f=await fixture(t),unconfigured=new QualityCollector(f.storage,f.content,f.runner);await assert.rejects(unconfigured.prepare(f.begin),{code:'QUALITY_SOURCE_PROVIDER_NOT_CONFIGURED'});assert.equal((await f.r.layout.store.request('inspect',{})).jobs,0);await f.prepare();await f.collector.bind(f.subject,{producerId:'front',pipelineId:f.pipelineId,ordinal:0});await assert.rejects(f.collector.bind(f.subject,{producerId:'front',pipelineId:'pipeline_other',ordinal:0}),{code:'QUALITY_STAGE_BINDING_IMMUTABLE'});f.sent();
 assert.throws(()=>f.run('UPDATE quality_stage_bindings SET stage_operation_id=?','op_other'),/QUALITY_STAGE_BINDING_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM quality_stage_bindings'),/QUALITY_STAGE_BINDING_RETAINED/);
 const g=await qualityStorageFixture(t,{pending:true,unprepared:true});g.run("UPDATE pipeline_stages SET state='SENT' WHERE pipeline_id=?",g.pipelineId);await assert.rejects(g.declare(g.sourceDescriptor),{code:'QUALITY_SOURCE_PREPARATION_TOO_LATE'});assert.equal(g.get('SELECT count(*) n FROM quality_materials').n,0);
});
test('a SOURCE publication that races an original dispatch cannot leave a content reference behind',async t=>{
 const f=await qualityStorageFixture(t,{pending:true,unprepared:true}),source=await f.declare(f.sourceDescriptor);await assert.rejects(f.storage.request('markPipelineStageSent',{pipelineId:f.pipelineId,ordinal:0}),{code:'QUALITY_SOURCE_NOT_PREPARED'});
 f.run("UPDATE pipeline_stages SET state='SENT' WHERE pipeline_id=?",f.pipelineId);await assert.rejects(f.put(source),{code:'QUALITY_SOURCE_PREPARATION_TOO_LATE'});assert.equal(f.get("SELECT content_hash FROM quality_materials WHERE material_key='source'").content_hash,null);assert.equal(f.get('SELECT 1 FROM content_objects WHERE content_hash=?',source.descriptor.sha256),undefined);assert.equal(f.get('SELECT state FROM object_write_operations WHERE expected_hash=?',source.descriptor.sha256).state,'SEALED');
});
test('Runner output reads enforce the original size budget before sending and bound streamed bytes',async t=>{
 const f=await fixture(t);await f.prepare();const job=await f.runJob(),ref=job.outputRefs[1],native=globalThis.fetch;let reads=0;
 globalThis.fetch=async(url,init)=>{reads++;const response=await native(url,init);if(String(url).endsWith('/outputs/1')){const bytes=Buffer.concat([Buffer.from(await response.arrayBuffer()),Buffer.from('x')]);return new Response(bytes,{status:response.status,headers:response.headers});}return response;};
 try{await assert.rejects(f.runner.output(job.jobId,1,ref,ref.byteSize-1),{code:'RUNNER_OUTPUT_LIMIT_INVALID'});assert.equal(reads,0);await assert.rejects(f.runner.output(job.jobId,1,ref),{code:'RUNNER_OUTPUT_TOO_LARGE'});assert.equal(reads,1);}finally{globalThis.fetch=native;}
 assert.equal((await f.read()).evaluation,null);assert.equal((await f.r.layout.store.request('inspect',{})).jobs,1);
});
