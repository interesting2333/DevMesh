import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {RunnerClient,RunnerPolicy,RunnerError,DockerBackend,startJob,serveRunner,openRunnerStorage,RunnerManager,RunnerMaterials} from '../packages/runner/dist/index.mjs';
import {fixture,request,until,ControlledBackend,image} from './fixtures/runner.mjs';

test('job protocol rejects caller shell arguments, mixed owners, invalid images and unsafe outputs',()=>{
 const r=request();for(const change of [{commandSpec:{kind:'build',argv:['sh','-c','bad']}},{imageDigest:'node:latest'},{outputSpec:['../secret']},{permit:{...r.permit,invocationId:'invocation_other'}}])assert.equal(startJob.safeParse({...r,...change}).success,false);
 assert.throws(()=>new RunnerClient('http://remote.example','x',async()=>undefined),RunnerError);
});
test('workspace policy binds current owner, allowed digest, command and resource scope',async t=>{
 const f=await fixture(t),r=request();const p=await f.policy.validate(r);assert.deepEqual(p.argv,['node','scripts/build.mjs']);
 for(const change of [{workspaceRef:'workspace2'},{networkPolicyRef:'internet'},{imageDigest:image.replace('a'.repeat(64),'b'.repeat(64))},{commandSpec:{kind:'install'}},{resourceLimits:{...r.resourceLimits,cpu:5}},{permit:{...r.permit,resources:[{kind:'workspace',resourceId:'other',access:'write'}]}}])await assert.rejects(f.policy.validate({...r,...change}));
 const linked=join(f.layout.dataRoot,'linked');await symlink(join(f.layout.dataRoot,'workspaces'),linked,process.platform==='win32'?'junction':'dir');const policy=new RunnerPolicy({...f.policy.config,dataRoot:linked});await assert.rejects(policy.validate(r));
});
test('independent Worker atomically deduplicates operations, scopes queries and rolls back invalid exit',async t=>{
 const f=await fixture(t),r=request(),execution=await f.policy.validate(r),input={controllerId:'controller.local',request:r,execution:{workspacePath:execution.workspacePath,argv:[...execution.argv]}};
 const jobs=await Promise.all(Array.from({length:8},()=>f.layout.store.request('register',input)));assert.equal(new Set(jobs.map(j=>j.jobId)).size,1);const job=jobs[0];
 await assert.rejects(f.layout.store.request('register',{...input,request:{...r,outputSpec:['result.json']}}),{code:'IDEMPOTENCY_KEY_REUSED'});
 await assert.rejects(f.manager.get('controller.other',job.jobId),{code:'JOB_NOT_FOUND'});
 await f.layout.store.request('claim',{jobId:job.jobId,maximumJobs:4,cpu:4,memoryMiB:1024});
 await assert.rejects(f.layout.store.request('record',{jobId:job.jobId,state:'EXITED',containerId:null,exitCode:0,evidence:null,errorCode:null}),{code:'JOB_EXIT_NOT_VERIFIED'});assert.equal((await f.manager.get('controller.local',job.jobId)).state,'STARTING');
 assert.deepEqual((await f.layout.store.request('inspect',{})).foreignKeyErrors,[]);
});
test('capacity holds unknown jobs, limits one workspace and two jobs per run',async t=>{
 const f=await fixture(t);const jobs=[];for(let i=1;i<=5;i++){const r=request(i,{run:i<4?1:2});jobs.push(await f.manager.submit('controller.local',r));}
 const claim=job=>f.layout.store.request('claim',{jobId:job.jobId,maximumJobs:4,cpu:4,memoryMiB:1024});assert.ok(await claim(jobs[0]));assert.ok(await claim(jobs[1]));assert.equal(await claim(jobs[2]),null);assert.ok(await claim(jobs[3]));assert.ok(await claim(jobs[4]));
 const r=request(1);r.operationId='op_same_workspace';const same=await f.manager.submit('controller.local',r);assert.equal(await claim(same),null);
 await f.layout.store.request('record',{jobId:jobs[0].jobId,state:'OUTCOME_UNKNOWN',containerId:null,exitCode:null,evidence:null,errorCode:'UNKNOWN'});assert.equal(await claim(jobs[2]),null);
});
test('real HTTP bearer identities, idempotency, cancellation and retained outputs',async t=>{
 const f=await fixture(t);await f.manager.start();const key='test-controller-key-long-enough';const server=await serveRunner(f.manager,{identities:[{controllerId:'controller.local',credentialRef:'local'},{controllerId:'other',credentialRef:'other'}],credentials:async ref=>ref==='local'?key:'other-controller-key-long'});f.cleanup.push(()=>server.close());
 const origin='http://127.0.0.1:'+server.address.port,client=new RunnerClient(origin,'local',async()=>key),other=new RunnerClient(origin,'other',async()=>'other-controller-key-long');
 assert.equal((await fetch(origin+'/runner/v1/jobs/unknown')).status,401);
 const r=request();r.outputSpec=['report.json'];await writeFile(join(f.layout.dataRoot,'workspaces/attempt_runner1/report.json'),'candidate report');const job=await client.start(r);assert.equal((await client.start(r)).jobId,job.jobId);await assert.rejects(other.get(job.jobId),{code:'JOB_NOT_FOUND'});
 await f.manager.tick();await until(async()=>(await client.get(job.jobId)).state==='RUNNING');await client.stop(job.jobId);const ended=await until(async()=>{const j=await client.get(job.jobId);return j.state==='EXITED'?j:null;});assert.equal(ended.exitCode,143);assert.equal(ended.stopEvidence.pid,0);assert.equal(ended.outputRefs.length,2);
 const response=await fetch(origin+'/runner/v1/jobs/'+job.jobId+'/outputs/1',{headers:{Authorization:'Bearer '+key}}),bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.toString(),'candidate report');assert.equal(response.headers.get('X-Content-SHA256'),createHash('sha256').update(bytes).digest('hex'));assert.equal(f.backend.starts.length,1);
});
test('lost start response queries original container and never starts it twice',async t=>{
 const backend=new ControlledBackend();backend.loseStart=true;const f=await fixture(t,{backend});await f.manager.start();const job=await f.manager.submit('controller.local',request());await f.manager.tick();await until(async()=>(await f.manager.get('controller.local',job.jobId)).state==='RUNNING');await f.manager.tick();assert.deepEqual(backend.starts,[job.jobId]);
});
test('lease watchdog stops without controller requests; an unknown stop retains capacity',async t=>{
 const backend=new ControlledBackend();backend.unknownStop=true;const f=await fixture(t,{backend});await f.manager.start();const job=await f.manager.submit('controller.local',request(1,{ttl:800}));await f.manager.tick();await until(async()=>(await f.manager.get('controller.local',job.jobId)).state==='RUNNING');const state=await until(async()=>{const j=await f.manager.get('controller.local',job.jobId);return j.stopRequested&&j.state==='OUTCOME_UNKNOWN'?j:null;});assert.equal(state.exitCode,null);assert.ok(backend.stops.length);assert.equal((await f.layout.store.request('active',{})).length,1);
});
test('renewals preserve owner, enforce sequence and current authority, and stop cannot be undone',async t=>{
 const f=await fixture(t);await f.manager.start();const r=request(),job=await f.manager.submit('controller.local',r);await f.manager.tick();await until(async()=>(await f.manager.get('controller.local',job.jobId)).state==='RUNNING');
 const permit={...r.permit,notBefore:new Date(Date.now()-5).toISOString(),expiresAt:new Date(Date.now()+14000).toISOString()};f.current.set(permit.grantId,permit);
 assert.equal((await f.manager.renew('controller.local',job.jobId,{permit,sequence:1})).leaseSequence,1);await f.manager.renew('controller.local',job.jobId,{permit,sequence:1});await assert.rejects(f.manager.renew('controller.local',job.jobId,{permit,sequence:0}));
 const changed={...permit,activationId:'activation_wrong'};f.current.set(permit.grantId,changed);await assert.rejects(f.manager.renew('controller.local',job.jobId,{permit:changed,sequence:2}),{code:'RUNNER_LEASE_OWNER_CHANGED'});f.current.set(permit.grantId,permit);await f.manager.stop('controller.local',job.jobId);await assert.rejects(f.manager.renew('controller.local',job.jobId,{permit,sequence:2}),{code:'JOB_NOT_RENEWABLE'});
});
test('configured roots are separate, unknown data is not adopted and terminal facts cannot regress',async t=>{
 const f=await fixture(t);await assert.rejects(openRunnerStorage({dataRoot:join(f.root,'control'),controlDataRoot:join(f.root,'control'),backupRoot:join(f.root,'backup'),runnerId:'x',initialize:true}));
 const unknown=join(f.root,'unknown');await mkdir(unknown);await writeFile(join(unknown,'unowned.txt'),'x');await assert.rejects(openRunnerStorage({dataRoot:unknown,controlDataRoot:join(f.root,'control'),backupRoot:join(f.root,'backup'),runnerId:'x',initialize:true}),{code:'RUNNER_ROOT_NOT_EMPTY'});
 const job=await f.manager.submit('controller.local',request());await f.manager.stop('controller.local',job.jobId);const original=await f.manager.get('controller.local',job.jobId);assert.equal(original.state,'EXITED');assert.equal(original.stopEvidence.neverDispatched,true);const db=new DatabaseSync(join(f.layout.dataRoot,'registry/runner.sqlite'));try{assert.throws(()=>db.prepare("UPDATE jobs SET state='RUNNING' WHERE job_id=?").run(job.jobId),/JOB_TERMINAL_IMMUTABLE/);}finally{db.close();}
});
test('restart reads original job records without replaying create/start',async t=>{
 const f=await fixture(t),job=await f.manager.submit('controller.local',request());await f.manager.start();await f.manager.tick();await until(async()=>(await f.manager.get('controller.local',job.jobId)).state==='RUNNING');f.backend.unknownStop=true;await f.manager.close();
 const backend=new ControlledBackend(),next=new RunnerManager(f.layout.store,f.policy,backend,f.authority,new RunnerMaterials(f.layout.dataRoot),{pollIntervalMs:10000});f.cleanup.push(()=>next.close());await next.start();await next.tick();const recovered=await next.get('controller.local',job.jobId);assert.equal(recovered.state,'OUTCOME_UNKNOWN');assert.equal(backend.starts.length,0);
});
test('Docker provider stays disabled without quota/runtime and exposes only bounded arguments',async()=>{
 const backend=new DockerBackend({runnerId:'runner.test',dockerPath:process.execPath,socketPath:'/var/run/docker.sock',workspaceBytes:1024**3});assert.equal(backend.configured,false);await assert.rejects(backend.probe(),{code:'RUNNER_NOT_CONFIGURED'});
 const r=request(),job={jobId:'job_args',requestHash:'b'.repeat(64),request:r};const argv=backend.createArguments(job,process.platform==='win32'?'D:\\runner\\workspace':'/runner/workspace',['node','build.mjs']);for(const flag of ['--runtime=runsc','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--user=10001:10001','--memory=128m','--pids-limit=32'])assert.ok(argv.includes(flag),flag);assert.ok(!argv.some(a=>a.includes('docker.sock')||a==='--privileged'||a==='--rm'));assert.deepEqual(argv.slice(-2),[image,'build.mjs']);
});
