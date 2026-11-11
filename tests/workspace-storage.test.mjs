import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile,lstat,readFile,rename,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {ControlledGit,LocalManagedWorkspaces} from '../packages/code-workspaces/dist/index.mjs';
import {ExecutionGrantLease} from '../packages/agent-runtime/dist/index.mjs';
import {httpFixture,prepareDispatch} from './fixtures/a2a-data.mjs';
import {meta} from './fixtures/storage-data.mjs';
const exec=promisify(execFile),op=()=> 'op_'+randomUUID().replaceAll('-',''),nullFile=process.platform==='win32'?'NUL':'/dev/null';
const git=async(root,...args)=>(await exec('git',['-c','core.fsmonitor=false','-c','core.hooksPath='+nullFile,...args],{cwd:root,windowsHide:true,encoding:'utf8',env:{...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:nullFile}})).stdout.trim();
async function identity(provider){const {root,gitDirectory,commonDirectory}=provider.identity,[r,g]=await Promise.all([lstat(root,{bigint:true}),lstat(gitDirectory,{bigint:true})]);return {root,gitDirectory,commonDirectory,rootDevice:String(r.dev),rootFileId:String(r.ino),gitDevice:String(g.dev),gitFileId:String(g.ino)};}
async function fixture(t,{claim=true,preparedDirectories=true}={}){
  const cleanup=[];t.after(async()=>{for(const fn of cleanup.toReversed())await fn();});const f=await httpFixture({after:fn=>cleanup.push(fn)}),root=join(f.root,'source');await mkdir(root);await mkdir(join(root,'src'));await writeFile(join(root,'src/board.ts'),'export const count = 0;\n');await git(root,'init','--quiet');await git(root,'config','user.name','Workspace fixture');await git(root,'config','user.email','fixture@localhost');await git(root,'add','.');await git(root,'commit','--quiet','--no-gpg-sign','-m','Initial');
  const base=await git(root,'rev-parse','HEAD'),source=await ControlledGit.open(root,'checkout'),manifest=await source.manifest(base);let repoIdentity,workspaceIdentity;
  if(preparedDirectories){const pack=await source.exportCommit(base),repository=await ControlledGit.initialize(join(f.root,'project.git'),'bare');await repository.importCommit(pack,base);await repository.updateRefs([{ref:'refs/devmesh/templates/initial',commit:base,expected:null}]);repoIdentity=await identity(repository);const checkout=await ControlledGit.initialize(join(f.root,'workspace'),'checkout');await checkout.importCommit(pack,base);await checkout.checkout(base);workspaceIdentity=await identity(checkout);}
  const p=await prepareDispatch(f,f.registry,{}, {baseCommit:base,resources:[{kind:'workspace',resourceId:'workspace_01',access:'write'},{kind:'projectRepository',resourceId:'repository_01',access:'write'}]});
  const sql=(query,...params)=>{const db=new DatabaseSync(join(f.local.dataRoot,'db/devmesh.sqlite'));try{return db.prepare(query).all(...params);}finally{db.close();}};
  const permit=JSON.parse(sql('SELECT permit_json FROM execution_grants WHERE attempt_id=?',p.attemptId)[0].permit_json);let lease;
  if(claim){await f.storage.request('acceptA2AWork',p.request);const [{endpointId,taskId,workerId,claimToken}]=await f.storage.request('claimAcceptedWork',{endpointId:'builtin.developer',workerId:'workspace.fixture'});lease=new ExecutionGrantLease(f.storage,{endpointId,taskId,workerId,claimToken},value=>Object.assign(permit,value));await lease.start();cleanup.push(()=>lease.stop());}
  const registration={principalId:'user_1',projectId:p.projectId,operationId:op(),resourceId:'repository_01',templateCommit:base},allocation={permit,operationId:op(),workspaceRef:'workspace_01',repositoryResourceId:'repository_01',runnerId:'runner.local',kind:'development',baseCommit:base};
  return {...f,p,sql,permit,lease,base,source,manifest,repoIdentity,workspaceIdentity,registration,allocation};
}
async function register(f){const pending=await f.storage.request('beginManagedRepository',f.registration);return f.storage.request('completeManagedRepository',{operationId:pending.operationId,requestHash:pending.requestHash,identity:f.repoIdentity,manifest:f.manifest});}
test('repository and allocation journals freeze the admitted owner, base, scope, actual source and physical identity',async t=>{
  const f=await fixture(t);await assert.rejects(f.storage.request('beginManagedRepository',{...f.registration,templateCommit:'f'.repeat(40)}),{code:'MANAGED_REPOSITORY_BASE_CHANGED'});const repository=await register(f);assert.equal(repository.state,'READY');assert.equal((await f.storage.request('beginManagedRepository',f.registration)).created,false);
  await assert.rejects(f.storage.request('getManagedRepository',{principalId:'another.user',projectId:f.p.projectId}),{code:'WORKSPACE_ACCESS_DENIED'});
  const pending=await f.storage.request('beginWorkspaceAllocation',f.allocation);assert.equal(pending.state,'PREPARING');assert.deepEqual(pending.scope,['src/board.ts']);assert.equal((await f.storage.request('beginWorkspaceAllocation',f.allocation)).created,false);
  await assert.rejects(f.storage.request('beginWorkspaceAllocation',{...f.allocation,baseCommit:'a'.repeat(40)}),{code:'IDEMPOTENCY_KEY_REUSED'});
  await assert.rejects(f.storage.request('completeWorkspaceAllocation',{operationId:pending.operationId,requestHash:pending.requestHash,identity:f.workspaceIdentity,manifest:{...f.manifest,sha256:'f'.repeat(64)}}),{code:'WORKSPACE_SOURCE_MANIFEST_INVALID'});
  const ready=await f.storage.request('completeWorkspaceAllocation',{operationId:pending.operationId,requestHash:pending.requestHash,identity:f.workspaceIdentity,manifest:f.manifest});assert.equal(ready.state,'READY');assert.equal(ready.baseCommit,f.base);assert.deepEqual(ready.identity,f.workspaceIdentity);assert.equal(f.sql('SELECT count(*) n FROM workspace_allocations')[0].n,1);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
  await assert.rejects(f.storage.request('completeWorkspaceAllocation',{operationId:pending.operationId,requestHash:pending.requestHash,identity:{...f.workspaceIdentity,rootFileId:'999999'},manifest:f.manifest}),{code:'WORKSPACE_ALLOCATION_RESULT_IMMUTABLE'});
});
test('an uncertain allocation preserves its original identity across pause and restart without admitting new work',async t=>{
  const f=await fixture(t);await register(f);const pending=await f.storage.request('beginWorkspaceAllocation',f.allocation);await f.storage.request('authorizeWorkspaceAllocation',{permit:f.permit,operationId:pending.operationId});await f.storage.request('markWorkspaceAllocationUncertain',{operationId:pending.operationId,requestHash:pending.requestHash,errorCode:'DIRECTORY_REPLY_LOST'});assert.equal((await f.storage.request('getWorkspaceAllocation',{permit:f.permit,operationId:pending.operationId})).state,'RECONCILE');
  const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});assert.equal((await f.storage.request('beginWorkspaceAllocation',f.allocation)).created,false);
  await assert.rejects(f.storage.request('authorizeWorkspaceAllocation',{permit:f.permit,operationId:pending.operationId}),{code:'WORKSPACE_ADMISSION_CLOSED'});
  await assert.rejects(f.storage.request('beginWorkspaceAllocation',{...f.allocation,operationId:op(),workspaceRef:'workspace_02'}),{code:'WORKSPACE_ADMISSION_CLOSED'});
  await f.lease.stop();await f.agents.stop();await f.local.close();const reopened=await f.reopen(),original=await reopened.storage.request('getWorkspaceAllocation',{permit:f.permit,operationId:pending.operationId});assert.equal(original.operationId,pending.operationId);assert.equal(original.state,'RECONCILE');assert.equal(original.identity,null);assert.equal(original.manifest,null);assert.equal(f.sql('SELECT count(*) n FROM workspace_allocations')[0].n,1);
});
test('allocation intent is allowed from an admitted grant before the A2A Host claims it',async t=>{
  const f=await fixture(t,{claim:false});await register(f);const result=await f.storage.request('beginWorkspaceAllocation',f.allocation);assert.equal(result.state,'PREPARING');assert.equal(f.sql('SELECT count(*) n FROM accepted_work')[0].n,0);
});

async function allocator(f,storage=f.storage){
  await mkdir(f.options.runnerDataRoot,{recursive:true});let held=false,acquired=0,released=0;
  // This fixture has no Runner jobs or editors. It proves the mandatory fence
  // boundary, not a production Runner implementation or cross-process lock.
  const fencer={async acquire(){assert.equal(held,false);held=true;acquired++;return {async release(){assert.equal(held,true);held=false;released++;}};}};
  const options={mode:'local-development',storage,controlDataRoot:f.options.dataRoot,runnerDataRoot:f.options.runnerDataRoot,backupRoot:f.options.backupRoot,runnerId:'runner.local',templates:new Map([[f.base,f.source]]),fencer};
  return {options,service:new LocalManagedWorkspaces(options),counts:()=>({held,acquired,released})};
}
test('local allocation recovers a lost READY reply and never overwrites edits or recreates a missing READY directory',async t=>{
  const f=await fixture(t,{preparedDirectories:false});let loseReply=true;
  const storage={async request(method,input){const result=await f.storage.request(method,input);if(method==='completeWorkspaceAllocation'&&loseReply){loseReply=false;throw Error('READY reply lost after commit');}return result;}};
  const a=await allocator(f,storage),repo=await a.service.ensureRepository(f.registration);assert.equal(repo.record.identity.root,await realpath(join(f.options.dataRoot,'repositories',f.p.projectId,'repo.git')));
  await assert.rejects(a.service.allocate(f.allocation),/READY reply lost/);const saved=await f.storage.request('getWorkspaceAllocation',{permit:f.permit,operationId:f.allocation.operationId});assert.equal(saved.state,'READY');
  const resumed=new LocalManagedWorkspaces(a.options),ready=await resumed.allocate(f.allocation);assert.equal(ready.record.operationId,saved.operationId);assert.deepEqual(ready.record.identity,saved.identity);assert.equal(await ready.provider.head(),f.base);assert.equal(ready.record.manifest.sha256,f.manifest.sha256);assert.equal(ready.record.identity.root,await realpath(join(f.options.runnerDataRoot,'workspaces',f.p.attemptId,'repo')));
  assert.equal(await git(ready.record.identity.root,'symbolic-ref','HEAD'),'refs/heads/devmesh/'+f.p.attemptId);
  const changed=join(ready.record.identity.root,'src/board.ts');await writeFile(changed,'export const count = 7;\n');await resumed.allocate(f.allocation);assert.equal(await readFile(changed,'utf8'),'export const count = 7;\n');
  const original=ready.record.identity.root;await rename(original,original+'.retained');await assert.rejects(resumed.allocate(f.allocation),{code:'WORKSPACE_DIRECTORY_MISSING'});await assert.rejects(lstat(original),{code:'ENOENT'});assert.equal(await readFile(join(original+'.retained','src/board.ts'),'utf8'),'export const count = 7;\n');
  assert.equal(f.sql('SELECT count(*) n FROM workspace_allocations')[0].n,1);assert.deepEqual(a.counts(),{held:false,acquired:5,released:5});
});
test('an unowned repository directory is preserved and never adopted as a completed allocation',async t=>{
  const f=await fixture(t,{preparedDirectories:false}),a=await allocator(f),unknown=join(f.options.dataRoot,'repositories',f.p.projectId);await mkdir(unknown);await writeFile(join(unknown,'owner.txt'),'pre-existing material');
  await assert.rejects(a.service.ensureRepository(f.registration),{code:'WORKSPACE_DIRECTORY_UNOWNED'});assert.equal(await readFile(join(unknown,'owner.txt'),'utf8'),'pre-existing material');await assert.rejects(lstat(join(unknown,'repo.git')),{code:'ENOENT'});assert.equal((await f.storage.request('getManagedRepository',{principalId:'user_1',projectId:f.p.projectId})).state,'PREPARING');assert.deepEqual(a.counts(),{held:false,acquired:1,released:1});
});
