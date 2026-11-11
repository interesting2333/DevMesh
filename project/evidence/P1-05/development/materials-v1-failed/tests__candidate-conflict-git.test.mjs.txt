import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,rename,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ControlledGit,LocalCandidateConflicts} from '../packages/code-workspaces/dist/index.mjs';
import {canonical} from '../packages/storage-sqlite/dist/index.mjs';
import {candidateGitFixture} from './fixtures/candidate-git.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

test('a legal disjoint-scope directory rename conflict retains exact original materials across computation and publication interruption',async t=>{
 const initial=Array.from({length:30},(_,i)=>'unique source line '+i).join('\n')+'\n';
 const f=await candidateGitFixture(t,{initial:{'old/a':initial},scopes:[['old/a','new/a'],['old/b','new/b']]});
 await f.develop(async root=>{await mkdir(join(root,'new'));await rename(join(root,'old/a'),join(root,'new/a'));});
 const oldBytes=Buffer.from('old b content\n'),newBytes=Buffer.from('new b different content\n');
 await f.develop(async root=>{await mkdir(join(root,'new'),{recursive:true});await writeFile(join(root,'old/b'),oldBytes);await writeFile(join(root,'new/b'),newBytes);});
 const input=f.input(),key={principalId:'user_1',operationId:input.operationId};let interrupted=false;
 const storage={async request(method,args){if(method==='prepareCandidateStep'&&args.ordinal===1&&!interrupted){interrupted=true;throw Error('Database unavailable before original conflict preparation');}return f.storage.request(method,args);}};
 const conflicts=new LocalCandidateConflicts(storage,f.content);
 await assert.rejects(f.service(storage,{conflicts}).integrate(input),/before original conflict preparation/);
 assert.equal((await f.storage.request('getCandidateIntegrationStep',{...key,ordinal:1})).state,'COMPUTING');
 const report=await f.storage.request('getCandidateMaterial',{...key,ordinal:1,materialKey:'report'});assert.ok(report.contentHash);
 const raw=await f.content.readText('user_1',{kind:'candidateMaterial',operationId:input.operationId,ordinal:1,materialKey:'report'},32*1024*1024),envelope=JSON.parse(raw),merge=envelope.merge;
 assert.equal(hash(raw),report.descriptor.sha256);assert.equal(merge.clean,false);assert.equal(merge.stages.length,0);assert.deepEqual([...new Set(merge.messages.flatMap(message=>message.paths))].sort(),['new/b','old/b']);
 const originalMerge=ControlledGit.prototype.mergeTree,originalPublish=f.content.provider.publish.bind(f.content.provider);let publicationInterrupted=false,mergeReplays=0;
 ControlledGit.prototype.mergeTree=async()=>{mergeReplays++;throw Error('Recovery must not recompute merge-tree');};
 f.content.provider.publish=async write=>{if(write.expectedHash===hash(newBytes)&&!publicationInterrupted){publicationInterrupted=true;throw Error('Original conflict file publication interrupted');}return originalPublish(write);};
 try{
  await assert.rejects(f.service(f.storage,{conflicts:new LocalCandidateConflicts(f.storage,f.content)}).reconcile(key),/file publication interrupted/);
  assert.equal((await f.storage.request('getCandidateIntegration',key)).state,'CONFLICT_PENDING');
  assert.equal(await f.repository.provider.readRef('refs/devmesh/candidates/'+f.p.runId),null);assert.equal(f.sql('SELECT count(*) n FROM managed_candidate_heads')[0].n,0);
  assert.equal(f.sql('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId)[0].accepted_release_id,null);
  const originalWrites=f.sql("SELECT write_id,expected_hash,state FROM object_write_operations WHERE purpose='candidateMaterial' AND expected_hash=?",hash(newBytes));assert.equal(originalWrites.length,1);assert.equal(originalWrites[0].state,'FAILED');
  const result=await f.service(f.storage,{conflicts:new LocalCandidateConflicts(f.storage,f.content)}).reconcile(key);assert.equal(result.state,'CONFLICT');assert.equal(result.acknowledgement,null);assert.equal(mergeReplays,0);
  const materials=await f.storage.request('listCandidateMaterials',{...key,ordinal:1,limit:100});assert.equal(materials.length,13);assert.equal(result.conflictAcknowledgement.materialCount,13);
  assert.equal(result.conflictAcknowledgement.reportSha256,hash(canonical(merge)));assert.equal((await f.storage.request('getCandidateMaterial',{...key,ordinal:1,materialKey:'report'})).contentHash,report.contentHash);
  assert.deepEqual(f.sql("SELECT write_id FROM object_write_operations WHERE purpose='candidateMaterial' AND expected_hash=?",hash(newBytes)).map(row=>row.write_id),[originalWrites[0].write_id]);
  for(const row of materials){const d=row.descriptor;if(d.kind==='FILE'){
   assert.equal(d.version,'theirs');const expected=d.path==='old/b'?oldBytes:newBytes,bytes=Buffer.from(await f.content.readBytes('user_1',{kind:'candidateMaterial',operationId:input.operationId,ordinal:1,materialKey:row.materialKey}));assert.deepEqual(bytes,expected);assert.equal(hash(bytes),d.sha256);assert.equal(row.contentHash,d.sha256);
  }else if(d.kind==='ABSENT'){assert.equal(row.contentHash,null);assert.equal(row.writeKey,null);} }
  for(const version of ['base.'+f.base,'ours','stage.1','stage.2','stage.3'])for(const path of ['new/b','old/b'])assert.ok(materials.find(row=>row.descriptor.kind==='ABSENT'&&row.descriptor.path===path&&row.descriptor.version===version));
  const baseEntries=await f.repository.provider.treeEntries(f.base);assert.equal(baseEntries.find(entry=>entry.path==='old').kind,'DIRECTORY');assert.equal(baseEntries.find(entry=>entry.path==='old/a').kind,'FILE');
  assert.deepEqual(await f.service(f.storage,{conflicts:new LocalCandidateConflicts(f.storage,f.content)}).reconcile(key),result);assert.equal(f.sql('SELECT count(*) n FROM candidate_integrations')[0].n,1);assert.deepEqual(f.sql('PRAGMA foreign_key_check'),[]);assert.equal(f.held.size,0);
 }finally{ControlledGit.prototype.mergeTree=originalMerge;f.content.provider.publish=originalPublish;}
});
