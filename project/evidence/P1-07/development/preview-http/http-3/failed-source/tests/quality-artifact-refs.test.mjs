import test from 'node:test';
import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {qualityRunnerFixture} from './fixtures/quality-runner.mjs';
async function fixture(t,options){const f=await qualityRunnerFixture(t,options);await f.prepare();await f.runJob();await f.collector.collect(f.subject);return f;}
test('original evaluated reports publish stable artifacts with exact bytes and source without another Job',async t=>{
 const f=await fixture(t),refs=await f.collector.references(f.subject);assert.deepEqual(refs.map(r=>r.materialKey),['report.coverage.front','report.tests.front','result']);
 for(const ref of refs){assert.equal(ref.targetCommit,f.q.input.scope.targetCommit);assert.deepEqual(await f.content.readBytes('user_1',{kind:'artifact',artifactId:ref.artifactId}),await f.content.readBytes('user_1',{kind:'qualityMaterial',operationId:f.subject.operationId,materialKey:ref.materialKey}));}
 assert.deepEqual(await f.collector.references(f.subject),refs);assert.equal(f.r.backend.starts.length,1);assert.equal(f.get('SELECT count(*) n FROM quality_artifact_refs').n,3);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);assert.throws(()=>f.run("UPDATE quality_artifact_refs SET material_key='other'"),/QUALITY_ARTIFACT_REF_IMMUTABLE/);await assert.rejects(f.storage.request('beginContentDeletion',{contentHash:refs[0].sha256}),{code:'CONTENT_REFERENCED'});
});
test('failed original reports can be referenced without rewriting failure as success',async t=>{
 const f=await fixture(t,{failed:true}),before=await f.read(),refs=await f.collector.references(f.subject);assert.equal(before.evaluation.automaticStatus,'FAIL');assert.equal(refs.length,3);assert.deepEqual(await f.read(),before);assert.equal(f.r.backend.starts.length,1);
});
test('artifact publication is atomic and a lost original ACK returns the same references',async t=>{
 const f=await fixture(t);f.db.exec("CREATE TRIGGER cut_quality_artifact BEFORE INSERT ON quality_artifact_refs BEGIN SELECT RAISE(ABORT,'quality-artifact-cut'); END");await assert.rejects(f.collector.references(f.subject),/quality-artifact-cut/);assert.equal(f.get('SELECT count(*) n FROM quality_artifact_refs').n,0);assert.equal(f.get("SELECT count(*) n FROM artifacts WHERE kind IN ('quality-result','quality-report')").n,0);f.db.exec('DROP TRIGGER cut_quality_artifact');const request=f.storage.request.bind(f.storage);let lost=true;f.storage.request=async(method,input)=>{const result=await request(method,input);if(method==='publishQualityArtifacts'&&lost){lost=false;throw Error('lost quality artifact ACK');}return result;};await assert.rejects(f.collector.references(f.subject),/lost quality artifact ACK/);const ids=f.db.prepare('SELECT artifact_id FROM quality_artifact_refs ORDER BY material_key').all().map(r=>r.artifact_id),refs=await f.collector.references(f.subject);assert.deepEqual(refs.map(r=>r.artifactId),ids);assert.equal(f.r.backend.starts.length,1);
});
test('unavailable actual report bytes, stale basis and altered proof set cannot publish new artifacts',async t=>{
 const f=await fixture(t),object=f.get("SELECT c.storage_key FROM content_objects c JOIN quality_materials m ON m.content_hash=c.content_hash WHERE m.material_key='result'");await rm(join(f.root,'artifacts',object.storage_key));await assert.rejects(f.collector.references(f.subject));assert.equal(f.get('SELECT count(*) n FROM quality_artifact_refs').n,0);
 const g=await fixture(t),v=await g.read();await assert.rejects(g.storage.request('publishQualityArtifacts',{...g.subject,requestHash:v.requestHash,contentHashes:['a'.repeat(64)]}),{code:'QUALITY_ARTIFACT_CONTENT_CHANGED'});g.run("UPDATE runs SET control_gate='PAUSED' WHERE run_id=?",g.p.runId);await assert.rejects(g.collector.references(g.subject),{code:'QUALITY_BASIS_STALE'});assert.equal(g.get('SELECT count(*) n FROM quality_artifact_refs').n,0);
});
test('original owner permission is checked again on reference publication and replay',async t=>{
 const f=await fixture(t);f.insert('project_members',{project_id:f.p.projectId,principal_id:'viewer.refs',role:'viewer',created_at:new Date().toISOString()});await assert.rejects(f.collector.references({...f.subject,principalId:'viewer.refs'}),{code:'QUALITY_NOT_FOUND'});assert.equal(f.get('SELECT count(*) n FROM quality_artifact_refs').n,0);await f.collector.references(f.subject);f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');await assert.rejects(f.collector.references(f.subject),{code:'QUALITY_NOT_FOUND'});
});
