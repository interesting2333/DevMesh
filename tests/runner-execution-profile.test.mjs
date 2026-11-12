import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {join} from 'node:path';
import {RunnerClient,RunnerManager,RunnerPolicy,RunnerMaterials,serveRunner} from '../packages/runner/dist/index.mjs';
import {fixture,request} from './fixtures/runner.mjs';
import {canonical} from './fixtures/storage-data.mjs';
const hash=argv=>createHash('sha256').update(canonical(argv)).digest('hex');
test('authenticated Runner reports the original immutable approved argv hash across configuration changes',async t=>{
 const f=await fixture(t),secret='original-execution-profile-fixture',http=await serveRunner(f.manager,{identities:[{controllerId:'controller.local',credentialRef:'local'}],credentials:async()=>secret});f.cleanup.push(()=>http.close());
 const client=new RunnerClient('http://127.0.0.1:'+http.address.port,'local',async()=>secret),original=request(),job=await client.start(original);
 assert.deepEqual(job.executionProfile,{runnerId:'runner.test',commandHash:hash(['node','scripts/build.mjs'])});assert.equal(JSON.stringify(job).includes(f.layout.dataRoot),false);
 const changed=['node','scripts/new-build.mjs'],policy=new RunnerPolicy({...f.policy.config,commands:{build:changed}}),next=new RunnerManager(f.layout.store,policy,f.backend,f.authority,new RunnerMaterials(f.layout.dataRoot));f.cleanup.push(()=>next.close());
 const recovered=await next.submit('controller.local',original);assert.equal(recovered.jobId,job.jobId);assert.deepEqual(recovered.executionProfile,job.executionProfile);
 const another=await next.submit('controller.local',{...original,operationId:'op_profile_changed'});assert.equal(another.executionProfile.commandHash,hash(changed));assert.notEqual(another.executionProfile.commandHash,job.executionProfile.commandHash);
 const db=new DatabaseSync(join(f.layout.dataRoot,'registry/runner.sqlite'));try{const row=db.prepare('SELECT execution_json FROM jobs WHERE job_id=?').get(job.jobId);assert.deepEqual(JSON.parse(row.execution_json).argv,['node','scripts/build.mjs']);assert.throws(()=>db.prepare('UPDATE jobs SET execution_json=? WHERE job_id=?').run(JSON.stringify({workspacePath:'changed',argv:changed}),job.jobId),/JOB_IDENTITY_IMMUTABLE/);}finally{db.close();}
 assert.equal(f.backend.starts.length,0);
});
