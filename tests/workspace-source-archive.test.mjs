import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {ControlledGit} from '../packages/code-workspaces/dist/index.mjs';
import {meta} from './fixtures/storage-data.mjs';
import {sourceArchiveFixture,archiveOp,archiveGit} from './fixtures/source-archive.mjs';

test('source retention transfers the original real MCP commit, preserves dirty work and recovers its durable ACK after restart',async t=>{
 const f=await sourceArchiveFixture(t),c=await f.commit('修'.repeat(3900)),input=f.input(c.operationId),path=join(f.binding.root,'src/board.ts');assert.ok(Buffer.byteLength((await f.storage.request('getRepoOperation',{permit:f.permit,operationId:c.operationId})).prepared.commitBody)>10000);await writeFile(path,'export const count = 99;\n');let lost=0;
 const storage={async request(method,args){const result=await f.storage.request(method,args);if(method==='completeSourceArchive'&&lost++===0)throw Error('Committed ACK reply lost');return result;}};
 const archived=await f.service(storage).archive(input);assert.equal(archived.state,'ACKNOWLEDGED');assert.equal(lost,1);assert.equal(archived.manifest.commit,c.result.commit);assert.equal(await readFile(path,'utf8'),'export const count = 99;\n');assert.equal(await f.repository.provider.readRef(archived.acknowledgement.archiveRef),c.result.commit);assert.equal(await f.repository.provider.readRef(archived.acknowledgement.sourceRef),c.result.commit);
 assert.equal(await archiveGit(f.repository.provider.identity.root,'show',c.result.commit+':src/board.ts'),'export const count = 1;');assert.equal(f.sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId)[0].accepted_release_id,null);assert.equal(f.held.size,0);
 await assert.rejects(f.service(f.storage).archive({...input,commitOperationId:archiveOp()}),{code:'IDEMPOTENCY_KEY_REUSED'});
 const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
 await f.lease.stop();await f.agents.stop();await f.local.close();const reopened=await f.reopen(),original=await f.service(reopened.storage).reconcile({permit:f.permit,operationId:input.operationId});assert.deepEqual(original.acknowledgement,archived.acknowledgement);assert.equal(original.acknowledgedAt,archived.acknowledgedAt);assert.equal(f.sql('SELECT count(*) n FROM source_archives')[0].n,1);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});

test('unprepared source archival remains unknown and blocks replacement without importing or creating refs',async t=>{
 const f=await sourceArchiveFixture(t),c=await f.commit(),input=f.input(c.operationId),pending=await f.storage.request('beginSourceArchive',input);assert.equal(pending.state,'SENT');
 await assert.rejects(f.service(f.storage).reconcile({permit:f.permit,operationId:input.operationId}),{code:'SOURCE_ARCHIVE_UNPREPARED'});assert.equal(await f.repository.provider.readRef('refs/devmesh/source-archives/'+input.operationId),null);await assert.rejects(f.repository.provider.commit(c.result.commit));assert.equal((await f.storage.request('getSourceArchive',{permit:f.permit,operationId:input.operationId})).state,'SENT');
 await assert.rejects(f.service(f.storage).archive({...input,operationId:archiveOp()}),{code:'SOURCE_ARCHIVE_RECONCILIATION_REQUIRED'});await assert.rejects(f.storage.request('getSourceArchive',{permit:{...f.permit,attemptId:'attempt_foreign'},operationId:input.operationId}));assert.equal(f.held.size,0);
});

test('prepared retained refs reconcile a lost acknowledgement without replaying object transfer after pause',async t=>{
 const f=await sourceArchiveFixture(t),c=await f.commit(),input=f.input(c.operationId),pending=await f.storage.request('beginSourceArchive',input),source=await ControlledGit.open(f.binding.root,'checkout'),manifest=await source.manifest(c.result.commit);
 await f.storage.request('prepareSourceArchive',{permit:f.permit,operationId:input.operationId,requestHash:pending.requestHash,manifest});await f.repository.provider.importCommit(await source.exportCommit(c.result.commit),c.result.commit);await f.repository.provider.updateRefs([{ref:'refs/devmesh/source-archives/'+input.operationId,commit:c.result.commit,expected:null},{ref:'refs/devmesh/sources/'+c.result.commit,commit:c.result.commit,expected:null}]);
 const run=await f.storage.request('getRun',{runId:f.p.runId});await f.storage.request('setControlIntent',{meta:meta(f.p.runId),runId:f.p.runId,ifMatch:`"r${run.resourceRevision}"`,action:'pause'});
 // A missing original checkout cannot trigger a new checkout or transfer. The
 // original retained project refs and frozen manifest prove this source ACK.
 await rename(f.binding.root,f.binding.root+'.retained');
 const archived=await f.service(f.storage).reconcile({permit:f.permit,operationId:input.operationId});assert.equal(archived.state,'ACKNOWLEDGED');assert.equal(archived.manifest.sha256,manifest.sha256);assert.equal(f.held.size,0);
});

test('source archive independently rejects a foreign parent, out of scope commit, special mode and missing commit object',async t=>{
 const f=await sourceArchiveFixture(t),c=await f.commit(),source=await ControlledGit.open(f.binding.root,'checkout');
 async function recordCommit({parent=f.base,scope=false,special=false,missing=false}={}){
  await archiveGit(f.binding.root,'read-tree',f.base);await writeFile(join(f.binding.root,'src/board.ts'),'export const count = 2;\n');await archiveGit(f.binding.root,'add','src/board.ts');
  if(scope){await writeFile(join(f.binding.root,'README.md'),'outside the approved Work\n');await archiveGit(f.binding.root,'add','README.md');}
  if(special){const object=await archiveGit(f.binding.root,'rev-parse',f.base+':src/board.ts');await archiveGit(f.binding.root,'update-index','--cacheinfo','120000,'+object+',src/board.ts');}
  const tree=await archiveGit(f.binding.root,'write-tree'),actual=await archiveGit(f.binding.root,'-c','user.name=Fixture','-c','user.email=fixture@localhost','commit-tree',tree,'-p',parent,'-m','Untrusted source fixture'),body=(await source.commit(actual)).body,operationId=archiveOp(),commit=missing?'e'.repeat(40):actual;
  const binding={workspaceRef:f.binding.workspaceRef,resourceId:f.binding.resourceId,projectResourceId:f.binding.projectResourceId,projectId:f.binding.projectId,runId:f.binding.runId,attemptId:f.binding.attemptId,baseCommit:f.base};
  const pending=await f.storage.request('beginRepoOperation',{permit:f.permit,operationId,toolName:'repo.commit',args:{workspaceRef:binding.workspaceRef,baseCommit:f.base,message:'Untrusted source fixture'},binding}),ref='refs/devmesh/operations/'+operationId;
  await f.storage.request('prepareRepoOperation',{permit:f.permit,operationId,requestHash:pending.requestHash,prepared:{commit,tree,ref,expected:null,commitBody:body}});if(!missing)await source.updateRefs([{ref,commit,expected:null}]);await f.storage.request('finishRepoOperation',{operationId,requestHash:pending.requestHash,state:'SUCCEEDED',result:{commit,tree,baseCommit:f.base,ref}});return f.input(operationId);
 }
 for(const [options,code] of [[{parent:c.result.commit},'SOURCE_ARCHIVE_COMMIT_CHANGED'],[{scope:true},'SOURCE_ARCHIVE_SCOPE_DENIED'],[{special:true},'GIT_SOURCE_PATH_DENIED']]){
  const input=await recordCommit(options);await assert.rejects(f.service(f.storage).archive(input),{code});const original=await f.storage.request('getSourceArchive',{permit:f.permit,operationId:input.operationId});assert.equal(original.state,'FAILED');assert.equal(await f.repository.provider.readRef('refs/devmesh/source-archives/'+input.operationId),null);
 }
 const input=await recordCommit({missing:true});await assert.rejects(f.service(f.storage).archive(input));const unknown=await f.storage.request('getSourceArchive',{permit:f.permit,operationId:input.operationId});assert.equal(unknown.state,'SENT');assert.equal(unknown.acknowledgement,null);assert.equal(f.held.size,0);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);
});
