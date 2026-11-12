import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,lstat,mkdir} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {LocalContentStore} from '../packages/blob-store/dist/index.mjs';
import {LocalWorkspacePreservations,LocalWorkspaceReclamations} from '../packages/code-workspaces/dist/index.mjs';
import {managedRunnerFixture} from './fixtures/managed-runner.mjs';
import {archiveOp,archiveGit} from './fixtures/source-archive.mjs';
import {meta} from './fixtures/storage-data.mjs';
import {until} from './fixtures/runner.mjs';

const release=(client,fence)=>client.releaseWorkspaceFence(fence.fenceId,{holderToken:fence.holderToken,requestHash:fence.requestHash});
const fence=(permit,parent)=>({operationId:archiveOp(),parentOperationId:parent,workspaceRef:'workspace_01',permit:structuredClone(permit),holderToken:randomUUID(),purpose:'cleanup'});
async function pause(f){const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:'"r'+run.resourceRevision+'"',action:'pause'});await f.lease.stop();}

test('managed maintenance uses original SQLite authority through authenticated Runner HTTP and cannot bypass queued or unknown jobs',async t=>{
 const f=await managedRunnerFixture(t,{allowedTools:['repo_commit','repo_by-operation','repo_writeFile','repo_fileByOperation']}),original=f.allocation.record.operationId;
 const key={permit:f.permit,operationId:original,workspaceRef:f.binding.workspaceRef,runnerId:'runner.local'};
 assert.equal((await f.storage.request('authorizeWorkspaceMaintenance',key)).operationKind,'allocation');
 for(const change of [{operationId:archiveOp()},{workspaceRef:'foreign'},{runnerId:'foreign'},{permit:{...f.permit,activationId:'activation_foreign'}}])await assert.rejects(f.storage.request('authorizeWorkspaceMaintenance',{...key,...change}));
 await assert.rejects(f.client.acquireWorkspaceFence(fence(f.permit,archiveOp())),{status:403});
 const editId=archiveOp(),bytes=await readFile(join(f.binding.root,'src/board.ts')),edit=await f.repoTools.find(t=>t.name==='repo.writeFile').execute({operationId:editId,permit:f.permit,args:{workspaceRef:f.binding.workspaceRef,baseCommit:f.base,path:'src/board.ts',expectedSha256:createHash('sha256').update(bytes).digest('hex'),text:'export const count = 2;\n'},signal:new AbortController().signal});assert.equal(edit.state,'SUCCEEDED');
 assert.equal((await f.storage.request('authorizeWorkspaceMaintenance',{...key,operationId:editId})).operationKind,'repoFile');
 const committed=await f.commit();assert.equal((await f.storage.request('authorizeWorkspaceMaintenance',{...key,operationId:committed.operationId})).operationKind,'repoGit');
 const archived=await f.service(f.storage).archive(f.input(committed.operationId));assert.equal(archived.state,'ACKNOWLEDGED');assert.equal((await f.storage.request('authorizeWorkspaceMaintenance',{...key,operationId:archived.operationId})).operationKind,'sourceArchive');
 await f.assertExecution(f.permit);const queued=await f.client.start(f.job(f.permit));assert.equal(queued.state,'QUEUED');await assert.rejects(f.client.acquireWorkspaceFence(fence(f.permit,original)),{status:409});
 assert.equal((await f.client.stop(queued.jobId)).stopEvidence.neverDispatched,true);
 const held=await f.client.acquireWorkspaceFence(fence(f.permit,original));await assert.rejects(f.client.start(f.job(f.permit)),{status:423});await release(f.client,held);
 const active=await f.client.start(f.job(f.permit));await f.manager.tick();await until(async()=>(await f.client.get(active.jobId)).state==='RUNNING');f.backend.unknownStop=true;await f.client.stop(active.jobId);await until(async()=>(await f.client.get(active.jobId)).state==='OUTCOME_UNKNOWN');
 await assert.rejects(f.client.acquireWorkspaceFence(fence(f.permit,original)),{status:409});assert.equal(f.backend.starts.length,1);
 f.backend.unknownStop=false;await f.manager.tick();await until(async()=>(await f.client.get(active.jobId)).state==='EXITED');
 await pause(f);await assert.rejects(f.client.start(f.job(f.permit)),{status:403});
 const read={...f.permit,resources:f.permit.resources.map(r=>({...r,access:'read'}))},clean=await f.client.acquireWorkspaceFence(fence(read,original));assert.equal(clean.state,'ACTIVE');await release(f.client,clean);
 assert.equal(f.sql('SELECT status FROM execution_grants WHERE grant_id=?',f.permit.grantId)[0].status,'REVOKED');
});

test('a test-tools-only owner can preserve and reclaim its exact original read-attenuated workspace via the real Runner maintenance boundary',async t=>{
 const f=await managedRunnerFixture(t,{allowedTools:['tests_get']}),content=new LocalContentStore(f.storage,f.local.dataRoot,0),sources=f.service(f.storage),preservations=new LocalWorkspacePreservations({...f.options,content,sourceArchives:sources}),service=new LocalWorkspaceReclamations(preservations,{retentionMs:0}),parent=dirname(f.binding.root);
 await writeFile(join(f.binding.root,'draft.txt'),'retained before Runner reclamation');const dataset=join(f.options.runnerDataRoot,'datasets','keep');await mkdir(dataset,{recursive:true});await writeFile(join(dataset,'data.txt'),'dataset stays');
 await f.assertExecution(f.permit);const queued=await f.client.start(f.job(f.permit)),save={permit:f.permit,operationId:archiveOp(),allocationOperationId:f.allocation.record.operationId};
 await assert.rejects(preservations.archive(save),{status:409});assert.equal((await f.storage.request('getWorkspacePreservation',{permit:f.permit,operationId:save.operationId})).state,'SENT');await f.client.stop(queued.jobId);
 const saved=await preservations.archive(save);assert.equal(saved.state,'ACKNOWLEDGED');assert.equal(saved.basis.commits.length,0);
 const input={permit:f.permit,operationId:archiveOp(),preservationOperationId:saved.operationId};await assert.rejects(service.reclaim(input),{code:'WORKSPACE_RECLAMATION_ADMISSION_OPEN'});
 await pause(f);input.permit={...f.permit,resources:f.permit.resources.map(r=>({...r,access:'read'}))};
 const reclaim=await f.storage.request('beginWorkspaceReclamation',input);const barrier=await f.client.acquireWorkspaceFence(fence(input.permit,reclaim.operationId));assert.equal(barrier.state,'ACTIVE');await assert.rejects(f.client.start(f.job(input.permit)),{status:403});await release(f.client,barrier);
 const result=await service.reclaim(input);assert.equal(result.state,'DELETED');await assert.rejects(lstat(parent),{code:'ENOENT'});assert.equal(await readFile(join(dataset,'data.txt'),'utf8'),'dataset stays');
 const reference=saved.manifest.retained[0];assert.equal(await archiveGit(f.repository.provider.identity.root,'rev-parse',reference.ref),f.base);
 assert.equal((await service.reclaim(input)).operationId,input.operationId);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);assert.equal((await f.layout.store.request('inspect',{})).jobs,1);assert.equal(f.backend.starts.length,0);
});
