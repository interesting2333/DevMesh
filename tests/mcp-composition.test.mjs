import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {startWorkflowMcpServices,McpToolClient} from '../packages/mcp-tools/dist/index.mjs';
import {startPlatform} from '../packages/platform-core/dist/index.mjs';
import {RunnerClient,RunnerManager,RunnerPolicy,RunnerMaterials,serveRunner} from '../packages/runner/dist/index.mjs';
import {httpFixture,prepareDispatch} from './fixtures/a2a-data.mjs';
import {contentFixture} from './fixtures/content-data.mjs';
import {fixture as runnerFixture,image,until} from './fixtures/runner.mjs';
import {meta} from './fixtures/storage-data.mjs';
import {ExecutionGrantLease} from '../packages/agent-runtime/dist/index.mjs';
const op=()=> 'op_'+randomUUID().replaceAll('-','');
const kinds=['repo','docs','tests','issues','pipeline'];
const identities=Object.fromEntries(kinds.map(kind=>[kind,{serviceId:kind+'.service',controllerId:kind+'.controller',credentialRef:kind+'.credential'}]));
const credentials=async ref=>'independent-local-service-secret-'+ref;

test('five separate MCP identities execute actual actions and keep original cleanup available after pause',async t=>{
  const cleanup=[];t.after(async()=>{const errors=[];for(const fn of cleanup.toReversed())try{await fn();}catch(e){errors.push(e);}if(errors.length)throw new AggregateError(errors,'Composition cleanup failed');});const context={after:fn=>cleanup.push(fn)};
  const f=await httpFixture(context),r=await runnerFixture(context),names=['repo.read','repo.list','docs.read','docs.search','tests.start','tests.get','tests.stop','tests.by-operation','issues.create','issues.get','issues.by-operation','issues.linkFix','issues.recordVerification','pipeline.start','pipeline.get','pipeline.stop','pipeline.by-operation','pipeline.logs','pipeline.artifacts'];
  const p=await prepareDispatch(f,f.registry,{allowedTools:names.map(n=>n.replaceAll('.','_'))},{resources:[{kind:'workspace',resourceId:'workspace_01',access:'write'},{kind:'snapshot',resourceId:'snapshot.resource',access:'read'},{kind:'dataset',resourceId:'docs.resource',access:'read'}]});
  await f.storage.request('acceptA2AWork',p.request);const [{endpointId,taskId,workerId,claimToken}]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'composition.fixture'});
  const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));let permit,artifact;try{permit=JSON.parse(db.prepare('SELECT permit_json FROM execution_grants WHERE attempt_id=?').get(p.attemptId).permit_json);artifact=db.prepare('SELECT content_hash,content_objects.byte_size FROM artifacts JOIN content_objects USING(content_hash) WHERE artifact_id=?').get(p.artifactId);}finally{db.close();}
  const lease=new ExecutionGrantLease(f.storage,{endpointId,taskId,workerId,claimToken},value=>{Object.assign(permit,value);r.current.set(value.grantId,value);});await lease.start();cleanup.push(()=>lease.stop());
  const snapshotRoot=join(f.root,'snapshot');await mkdir(snapshotRoot);const bytes=Buffer.from('repository snapshot\n');await writeFile(join(snapshotRoot,'README.md'),bytes);
  const relativePath='workspaces/'+p.attemptId;await mkdir(join(r.layout.dataRoot,relativePath));
  const policy=new RunnerPolicy({...r.policy.config,
    commands:{...r.policy.config.commands,'playwright-mcp':['node','/opt/devmesh/playwright-mcp/task-board.mjs']},
    workspaces:{workspace_01:{attemptId:p.attemptId,ownerKind:'workflowAttempt',resourceId:'workspace_01',relativePath}}});
  const manager=new RunnerManager(r.layout.store,policy,r.backend,r.authority,new RunnerMaterials(r.layout.dataRoot),{pollIntervalMs:10000}),secret='composition-runner-service-secret';
  const http=await serveRunner(manager,{identities:[{controllerId:'controller.local',credentialRef:'runner.credential'}],credentials:async()=>secret});r.cleanup.push(()=>http.close());await manager.start();
  cleanup.push(()=>manager.close());
  const runner=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner.credential',async()=>secret),resourceLimits={cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:10000};
  const services=await startWorkflowMcpServices(f.storage,f.content,{identities,credentials,
    repo:{snapshots:[{snapshotRef:'snapshot.v1',resourceId:'snapshot.resource',root:snapshotRoot,files:[{path:'README.md',sha256:createHash('sha256').update(bytes).digest('hex'),byteSize:bytes.length}]}]},
    docs:[{documentRef:'plan',version:'v1',resourceId:'docs.resource',runId:p.runId,principalId:'user_1',reference:{kind:'artifact',artifactId:p.artifactId},sha256:artifact.content_hash,byteSize:artifact.byte_size}],
    issues:true,tests:{runner,checks:[{checkId:'approved.playwright',imageDigest:image,commandSpec:{kind:'playwright-mcp'},resourceLimits,networkPolicyRef:'none',outputSpec:[]}]},
    pipeline:{runner,definitions:[{definitionId:'approved.pipeline',version:'v1',stages:[{stageId:'build',kind:'build',imageDigest:image,resourceLimits,networkPolicyRef:'none',outputSpec:[]}]}]}});cleanup.push(()=>services.close());
  assert.equal(services.connections.length,5);assert.equal(new Set(services.connections.map(c=>c.endpoint)).size,5);assert.equal(new Set(services.connections.map(c=>c.server.name)).size,5);
  assert.deepEqual(services.playwrightMcpCheckIds,['approved.playwright']);
  const execute=(name,args,key=op())=>services.tools.find(t=>t.name===name).execute(key,args,{permit},new AbortController().signal);
  const read=await execute('repo_read',{snapshotRef:'snapshot.v1',path:'README.md'});assert.equal(read.state,'SUCCEEDED');assert.equal(read.value.source,'mcp');assert.equal(read.value.result.text,bytes.toString());
  const doc=await execute('docs_read',{documentRef:'plan',version:'v1'});assert.equal(doc.state,'SUCCEEDED');assert.equal(doc.value.result.sha256,artifact.content_hash);
  const issue=await execute('issues_create',{title:'Composition evidence',description:'Created through independent MCP',severity:'LOW',evidence:{artifactId:p.artifactId,sha256:artifact.content_hash}});assert.equal(issue.state,'SUCCEEDED');
  const job=await execute('tests_start',{checkId:'approved.playwright',workspaceRef:'workspace_01'});
  assert.equal(job.state,'SUCCEEDED');
  assert.equal(job.value.result.request.commandSpec.kind,'playwright-mcp');
  assert.equal(job.value.result.request.networkPolicyRef,'none');
  await manager.tick();await until(async()=>(await runner.get(job.value.result.jobId)).state==='RUNNING');
  const pipeline=await execute('pipeline_start',{definitionId:'approved.pipeline',workspaceRef:'workspace_01'});assert.equal(pipeline.state,'SUCCEEDED');assert.notEqual(pipeline.value.result.pipelineId,job.value.result.jobId);
  const bad=new McpToolClient({endpointId:'cross-identity',endpoint:services.connections[0].endpoint,credentialRef:'docs.credential',credentials});await assert.rejects(bad.connect(),{code:'MCP_CONNECT_FAILED'});await bad.close();
  services.stopAdmission();const rejected=await execute('issues_create',{title:'Closing',description:'No new admission',severity:'LOW',evidence:{artifactId:p.artifactId,sha256:artifact.content_hash}});assert.equal(rejected.state,'FAILED');assert.equal(rejected.value.code,'MCP_STOPPING');
  const run=await f.storage.request('getRun',{runId:p.runId});await f.storage.request('setControlIntent',{meta:meta(p.runId),runId:p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
  assert.equal((await execute('tests_get',{jobId:job.value.result.jobId})).state,'SUCCEEDED');assert.equal((await execute('tests_stop',{jobId:job.value.result.jobId})).state,'SUCCEEDED');
  assert.equal((await execute('pipeline_stop',{pipelineId:pipeline.value.result.pipelineId})).state,'SUCCEEDED');
  const endpoints=services.connections.map(c=>c.endpoint);await services.close();await services.close();for(const url of endpoints)await assert.rejects(fetch(url,{method:'POST',headers:{Authorization:'Bearer '+await credentials('repo.credential'),'Content-Type':'application/json'},body:'{}'}));
});

test('composition rejects shared credentials and platform owns optional MCP startup and release',async t=>{
  const f=await contentFixture(t);
  await assert.rejects(startWorkflowMcpServices(f.storage,f.content,{identities:{issues:identities.issues,docs:identities.docs},credentials:async()=> 'shared-service-secret',issues:true,docs:[]}),{code:'MCP_SERVICE_CREDENTIALS_MUST_DIFFER'});
  await f.local.close();const config={host:'127.0.0.1',port:0,shutdownTimeoutMs:2000,storage:f.options};
  await assert.rejects(startPlatform(config,{mcp:()=>({identities:{issues:identities.issues},credentials:async()=>undefined,issues:true})}),{code:'MCP_NOT_CONFIGURED'});
  const platform=await startPlatform(config,{mcp:()=>({identities:{issues:identities.issues},credentials,issues:true})});t.after(()=>platform.stop());
  assert.equal(platform.mcp.connections.length,1);assert.equal(platform.mcp.connections[0].server.name,'issues.service');const endpoint=platform.mcp.connections[0].endpoint;
  await platform.stop();await assert.rejects(fetch(endpoint,{method:'POST'}));
});
