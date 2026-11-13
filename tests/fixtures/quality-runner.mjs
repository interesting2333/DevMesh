import {mkdir,writeFile} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {QualityCollector} from '../../packages/result-verifier/dist/index.mjs';
import {RunnerClient,RunnerManager,RunnerPolicy,RunnerMaterials,serveRunner} from '../../packages/runner/dist/index.mjs';
import {PipelineCoordinator} from '../../packages/mcp-tools/dist/index.mjs';
import {qualityStorageFixture} from './quality-storage.mjs';
import {fixture as runnerFixture,until} from './runner.mjs';
import {canonical,hash} from './storage-data.mjs';

// Source/A2A admission are explicit DB fixtures, including an independently
// constructed map. Runner Job persistence, authenticated HTTP, output files,
// coordinator receipts and content publication below are real local components.
export async function qualityRunnerFixture(t,options={}){
 const f=await qualityStorageFixture(t,{pending:true,unprepared:true,...options,runnerId:'runner.test',failed:options.failed}),r=await runnerFixture(t),path='workspaces/'+f.attemptId,workspace=join(r.layout.dataRoot,path);await mkdir(workspace,{recursive:true});
 const policy=new RunnerPolicy({...r.policy.config,imageDigests:[f.q.policy.producers[0].imageDigest],commands:{unit:f.q.policy.producers[0].command},workspaces:{[f.workspaceRef]:{attemptId:f.attemptId,ownerKind:'workflowAttempt',resourceId:f.workspaceRef,relativePath:path}}});
 const manager=new RunnerManager(r.layout.store,policy,r.backend,r.authority,new RunnerMaterials(r.layout.dataRoot),{pollIntervalMs:600000});r.cleanup.push(()=>manager.close());
 const writeOutputs=async()=>{for(const report of [...f.q.reports.map(r=>({path:r.report.outputPath,bytes:r.bytes})),...f.extraOutputs]){const target=join(workspace,report.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,report.bytes);}};
 const backendStart=r.backend.start.bind(r.backend);r.backend.start=async(...args)=>{if(!options.completeOnStart)await writeOutputs();const fact=await backendStart(...args);if(options.completeOnStart){Object.assign(fact,{state:'exited',pid:0,exitCode:options.failed?1:0,finishedAt:new Date().toISOString()});r.backend.facts.set(args[0].jobId,fact);}return fact;};
 const secret='quality-original-output-local-test',http=await serveRunner(manager,{identities:[{controllerId:'controller.local',credentialRef:'runner'}],credentials:async()=>secret});r.cleanup.push(()=>http.close());await manager.start();
 const runner=new RunnerClient('http://127.0.0.1:'+http.address.port,'runner',async()=>secret),coordinator=new PipelineCoordinator(f.storage,runner);let prepared=0;
 const source={providerId:'explicit-independent-map-fixture',toolchainHash:hash('fixture-only-not-production-instrumentation'),async prepare(){prepared++;return structuredClone(f.q.input.scope);}},collector=new QualityCollector(f.storage,f.content,runner,source),subject={principalId:'user_1',operationId:f.bound.operationId};
 async function prepare(){await collector.prepare(f.begin);await collector.bind(subject,{producerId:'front',pipelineId:f.pipelineId,ordinal:0});}
 // This fixture has explicit DB admission, not an A2A Runtime heartbeat.
 // Issue its scripted grant immediately before dispatch; retain the real 15s
 // Runner lease limit and 10s execution timeout. This is not production renewal.
 function currentFixturePermit(){const grant=f.get('SELECT * FROM execution_grants WHERE grant_id=?',f.grant.grant_id);if(grant.status!=='ACTIVE')throw Error('Fixture grant was revoked');const at=Date.now(),permit={...JSON.parse(grant.permit_json),notBefore:new Date(at-10).toISOString(),expiresAt:new Date(at+14990).toISOString()};f.run('UPDATE execution_grants SET permit_json=?,expires_at=? WHERE grant_id=?',canonical(permit),permit.expiresAt,grant.grant_id);return permit;}
 function sent(permit=JSON.parse(f.grant.permit_json)){const request={schemaVersion:'devmesh.runner-job.v1',operationId:f.execution.operationId,permit,imageDigest:f.q.policy.producers[0].imageDigest,workspaceRef:f.workspaceRef,commandSpec:{kind:'unit'},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:10000},networkPolicyRef:'none',outputSpec:[...f.q.policy.reports.map(r=>r.path),...f.extraOutputs.map(r=>r.path)]};
  f.run("UPDATE pipeline_stages SET state='SENT',request_json=? WHERE pipeline_id=?",canonical(request),f.pipelineId);return request;}
 async function runJob(){
  // Scripted delivery fixtures do not execute a real build. Stage their fixed
  // bytes before issuing the real short lease, then return an exited physical
  // fact directly. Job admission, authenticated HTTP, collection and journals
  // still run through production components; this is not a timing benchmark.
  if(options.completeOnStart)await writeOutputs();
  const request=sent(currentFixturePermit()),job=await runner.start(request),dispatch={pipelineId:f.pipelineId,ordinal:0,operationId:request.operationId,state:'SENT',jobId:null,stopRequested:false,request};await coordinator.process(dispatch);await manager.tick();
  if(!options.completeOnStart){await until(async()=>(await runner.get(job.jobId)).state==='RUNNING');const fact=r.backend.facts.get(job.jobId);r.backend.facts.set(job.jobId,{...fact,state:'exited',pid:0,exitCode:options.failed?1:0,finishedAt:new Date().toISOString()});await manager.tick();}
  await until(async()=>(await runner.get(job.jobId)).state==='EXITED',options.completeOnStart?120000:5000);await coordinator.process({...dispatch,state:'ACKED',jobId:job.jobId});const result=await runner.get(job.jobId);
  if(options.completeOnStart&&(result.exitCode!==(options.failed?1:0)||result.errorCode||result.stopRequested))throw Error('Scripted quality job did not finish cleanly: '+JSON.stringify({state:result.state,exitCode:result.exitCode,errorCode:result.errorCode,stopRequested:result.stopRequested}));
  return result;
 }
 return {...f,r,runner,manager,coordinator,collector,subject,source,prepare,sent,runJob,prepared:()=>prepared};
}
