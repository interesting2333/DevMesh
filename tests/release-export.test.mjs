import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,writeFile,rename} from 'node:fs/promises';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';import {once} from 'node:events';
import {ReleaseExporter,buildExportZip,exportPath} from '../packages/result-verifier/dist/index.mjs';
import {redactExportRecord} from '../packages/storage-sqlite/dist/index.mjs';
import {mountInputApi} from '../packages/input-api/dist/index.mjs';
import {releaseExportFixture} from './fixtures/release-export.mjs';
import {hash,canonical,meta} from './fixtures/storage-data.mjs';
const who=job=>({principalId:'user_1',exportId:job.exportId});
const express=createRequire(new URL('../packages/input-api/package.json',import.meta.url))('express');
const unpack=bytes=>{const out=new Map();let n=0;while(bytes.readUInt32LE(n)===0x04034b50){assert.equal(bytes.readUInt16LE(n+8),0);const length=bytes.readUInt32LE(n+18),names=bytes.readUInt16LE(n+26),extra=bytes.readUInt16LE(n+28),path=bytes.subarray(n+30,n+30+names).toString(),start=n+30+names+extra;assert(!out.has(path));out.set(path,bytes.subarray(start,start+length));n=start+length;}assert.equal(bytes.readUInt32LE(n),0x02014b50);const end=bytes.length-22;assert.equal(bytes.readUInt32LE(end),0x06054b50);assert.equal(bytes.readUInt16LE(end+10),out.size);return out;};
const archive=async(f,j)=>Buffer.from(await f.exportContent().readBytes('user_1',{kind:'releaseExport',exportId:j.exportId}));
const unchanged=f=>canonical({release:f.get('SELECT * FROM releases'),acceptance:f.get('SELECT * FROM acceptance_commits'),outbox:f.get('SELECT * FROM release_promotion_outbox'),run:f.get('SELECT * FROM runs'),publication:f.get('SELECT * FROM release_publications')});

test('accepted export freezes exact source, configuration, quality and collaboration; real CAS ZIP survives restart',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),before=unchanged(f);
 await f.exportContent().putJson(meta(f.p.runId),{kind:'message',sessionId:f.tester.sessionId,clientMessageId:'export-safe-message',activationId:f.tester.activationId,messageKind:'assistant'},{content:'Visible collaboration',reasoning_content:'private internal reasoning',credentialRef:'private reference'});
 const input={meta:meta(f.publication.releaseId),releaseId:f.publication.releaseId,format:'zip'},j=await f.call('createReleaseExport',input);
 assert.equal(j.state,'QUEUED');assert.deepEqual(await f.call('createReleaseExport',input),j);assert.equal(f.get('SELECT count(*) n FROM release_exports').n,1);
 const result=await f.exporter().advance(...Object.values(who(j)));assert.equal(result.state,'READY',JSON.stringify(result));
 const bytes=await archive(f,result),files=unpack(bytes),manifest=JSON.parse(files.get('manifest.json'));
 assert.equal(hash(bytes),result.archiveHash);assert.equal(bytes.length,result.archiveSize);assert.deepEqual(files.get('source/src/app.ts'),f.sourceBytes);
 assert.equal(manifest.codeCommit,f.sourceManifest.commit);assert.equal(manifest.cutoffSeq,j.cutoffSeq);assert.equal(manifest.snapshotHash,j.snapshotHash);assert.equal(manifest.entryCount,files.size-1);assert.deepEqual(manifest.missing,[]);
 for(const item of manifest.files){assert.equal(hash(files.get(item.path)),item.sha256);assert.equal(files.get(item.path).length,item.byteSize);}
 const zipPath=join(f.exportRoot,'delivery.zip');await writeFile(zipPath,bytes);assert.deepEqual(execFileSync('tar',['-xOf',zipPath,'source/src/app.ts'],{windowsHide:true,timeout:30000,maxBuffer:1024*1024}),f.sourceBytes);
 const records=JSON.parse(files.get('records.json'));assert(records.roles.length>=3);assert(records.a2a.length);assert(records.events.length);assert(records.plan.works.length);assert(!canonical(records).includes('permit_json'));
 assert.equal(hash(canonical(records.qualityConfiguration)),manifest.checkConfigHash);assert.equal(records.acceptance.releaseId,j.releaseId);assert(records.userMessages.length);for(const role of records.roles){const prompt=records.artifactIndex.find(a=>a.artifactId===role.configuration.promptArtifactId);assert(prompt);assert(files.has(prompt.path));}
 const message=JSON.parse(files.get('collaboration/messages/0.json'));assert.deepEqual(message,{content:'Visible collaboration'});
 assert.equal(unchanged(f),before);await f.reopen();assert.deepEqual(await archive(f,result),bytes);assert.equal((await f.call('getReleaseExport',who(j))).state,'READY');
 await assert.rejects(f.call('beginContentDeletion',{contentHash:result.archiveHash}),{code:'CONTENT_REFERENCED'});
});

test('packing missing material fails only export; retry keeps snapshot and produces original bytes',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),j=await f.create(),before=unchanged(f),m=f.get('SELECT * FROM release_export_materials WHERE export_id=? LIMIT 1',j.exportId),path=join(f.exportContent().dataRoot,'artifacts','sha256',m.content_hash.slice(0,2),m.content_hash),held=path+'.held';
 await rename(path,held);const failed=await f.exporter().advance('user_1',j.exportId);assert.equal(failed.state,'FAILED');assert.equal(unchanged(f),before);
 const original=await readFile(held);await rename(held,path);await f.exportContent().putBytes(meta(),{kind:'content'},original,'application/octet-stream');await f.call('retryReleaseExport',{...who(j),expectedGeneration:failed.generation});
 const ready=await f.exporter().advance('user_1',j.exportId);assert.equal(ready.state,'READY',JSON.stringify(ready));assert.equal(ready.snapshotHash,j.snapshotHash);assert.equal(ready.cutoffSeq,j.cutoffSeq);assert.equal(unchanged(f),before);
});

test('claims exclude concurrent packers, reject stale workers, and preserve frozen source on retry',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),j=await f.create(),[a,b]=await Promise.all([f.call('claimReleaseExport',who(j)),f.call('claimReleaseExport',who(j))]),claimed=a??b;assert.equal([a,b].filter(Boolean).length,1);
 await assert.rejects(f.call('retryReleaseExport',{...who(j),expectedGeneration:1}),{code:'EXPORT_IN_PROGRESS'});
 f.run('UPDATE release_exports SET lease_until=? WHERE export_id=?','2000-01-01T00:00:00.000Z',j.exportId);
 await f.call('retryReleaseExport',{...who(j),expectedGeneration:1});const newer=await f.call('claimReleaseExport',who(j));assert.equal(newer.generation,2);assert.deepEqual(newer.snapshot,claimed.snapshot);
 const old={...who(j),generation:claimed.generation,claimToken:claimed.claimToken};await assert.rejects(f.call('getReleaseExportContext',old),{code:'EXPORT_CLAIM_STALE'});
 await assert.rejects(f.exportContent().readBytes('user_1',{kind:'exportMaterial',exportId:j.exportId,materialKey:newer.snapshot.materials[0].key,generation:1,claimToken:claimed.claimToken}),{code:'EXPORT_CLAIM_STALE'});
 await f.call('failReleaseExport',{...who(j),generation:2,claimToken:newer.claimToken,errorCode:'EXPORT_INTERRUPTED'});await f.call('retryReleaseExport',{...who(j),expectedGeneration:2});assert.equal((await f.exporter().advance('user_1',j.exportId)).state,'READY');
});

test('registered archive ACK loss recovers READY rather than failing or creating another release',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),j=await f.create(),storage=f.storage,original=storage.request.bind(storage);let lost=false;
 storage.request=async(m,i)=>{const result=await original(m,i);if(m==='commitObjectWrite'&&i.principalId==='user_1'&&!lost){lost=true;throw Error('explicit lost archive registration ACK');}return result;};
 const result=await f.exporter().advance('user_1',j.exportId);assert.equal(result.state,'READY');assert(lost);assert.equal(f.get('SELECT count(*) n FROM releases').n,1);assert.equal(f.get("SELECT count(*) n FROM object_write_operations WHERE purpose='releaseExport'").n,1);
});

test('prepared archive ACK loss, terminated Worker and source corruption retain original job and archive',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),j=await f.create(),before=unchanged(f),original=f.storage.request.bind(f.storage);let lost=false;
 f.storage.request=async(m,i)=>{const result=await original(m,i);if(m==='prepareReleaseExportArchive'&&!lost){lost=true;throw Error('explicit prepared archive ACK loss');}return result;};
 const failed=await f.exporter().advance('user_1',j.exportId);assert.equal(failed.state,'FAILED');assert(failed.archiveHash);assert(lost);f.storage.request=original;
 await f.crash();await f.reopen();await f.call('retryReleaseExport',{...who(j),expectedGeneration:failed.generation});
 const ready=await f.exporter().advance('user_1',j.exportId);assert.equal(ready.state,'READY');assert.equal(ready.archiveHash,failed.archiveHash);assert.equal(unchanged(f),before);
 const second=await f.create(),bad=new ReleaseExporter(f.exportContent(),{async read(context,signal){const files=await f.sources.read(context,signal);files[0].bytes=Buffer.from('changed immutable source');return files;}});
 const rejected=await bad.advance('user_1',second.exportId);assert.equal(rejected.state,'FAILED');assert.equal(rejected.errorCode,'EXPORT_SOURCE_CHANGED');assert.equal(unchanged(f),before);
 await f.call('retryReleaseExport',{...who(second),expectedGeneration:rejected.generation});const again=await f.exporter().advance('user_1',second.exportId);assert.equal(again.state,'READY');assert.equal(again.archiveHash,ready.archiveHash);
});

test('export registration rollback and immutable references; late live records never enter the frozen archive',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),before=unchanged(f),input={meta:meta(f.publication.releaseId),releaseId:f.publication.releaseId,format:'zip'};
 f.db.exec("CREATE TRIGGER explicit_export_cut BEFORE INSERT ON release_export_materials BEGIN SELECT RAISE(ABORT,'EXPLICIT_EXPORT_CUT'); END");
 await assert.rejects(f.call('createReleaseExport',input),/EXPLICIT_EXPORT_CUT/);assert.equal(f.get('SELECT count(*) n FROM release_exports').n,0);assert.equal(f.get('SELECT count(*) n FROM operations WHERE idempotency_key=?',input.meta.idempotencyKey).n,0);assert.equal(unchanged(f),before);f.db.exec('DROP TRIGGER explicit_export_cut');
 const j=await f.call('createReleaseExport',input);assert.throws(()=>f.run('UPDATE release_exports SET snapshot_json=? WHERE export_id=?','{}',j.exportId),/EXPORT_SNAPSHOT_IMMUTABLE/);
 const m=f.get('SELECT * FROM release_export_materials WHERE export_id=? LIMIT 1',j.exportId);assert.throws(()=>f.run('DELETE FROM release_export_materials WHERE export_id=? AND material_key=?',j.exportId,m.material_key),/EXPORT_MATERIAL_RETAINED/);await assert.rejects(f.call('beginContentDeletion',{contentHash:m.content_hash}),{code:'CONTENT_REFERENCED'});
 const original=f.get('SELECT * FROM events WHERE run_id=? ORDER BY seq DESC LIMIT 1',f.p.runId),late={...original,event_id:'event_export_late_fixture',seq:j.cutoffSeq+1,payload_json:canonical({lateMarker:'must not enter prior export'})},keys=Object.keys(late);f.run('INSERT INTO events('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')',...Object.values(late));f.run('UPDATE runs SET event_seq=event_seq+1 WHERE run_id=?',f.p.runId);
 await writeFile(join(f.checkout,'src','app.ts'),'changed live checkout after acceptance');
 const ready=await f.exporter().advance('user_1',j.exportId),files=unpack(await archive(f,ready)),records=JSON.parse(files.get('records.json'));assert.equal(ready.cutoffSeq,j.cutoffSeq);assert(records.events.every(e=>e.seq<=j.cutoffSeq));assert(!files.get('records.json').toString().includes('must not enter prior export'));assert.deepEqual(files.get('source/src/app.ts'),f.sourceBytes);
});

test('download reauthenticates current members; GET never packs; errors remain inert',{timeout:120000},async t=>{
 const f=await releaseExportFixture(t),content=f.exportContent(),app=express(),api=mountInputApi(app,content,{enabled:true,baseline:{version:'test.v1',baseCommit:'b'.repeat(40)},identityResolver:req=>({principalId:req.headers['x-test-principal']??'user_1'})}),server=app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await api.stop();});const origin='http://127.0.0.1:'+server.address().port;
 const response=await fetch(origin+'/api/v1/releases/'+f.publication.releaseId+'/exports',{method:'POST',headers:{'content-type':'application/json','idempotency-key':meta().idempotencyKey},body:JSON.stringify({format:'zip'})});assert.equal(response.status,202);const j=await response.json(),base=origin+'/api/v1/exports/'+j.exportId;
 assert.equal((await fetch(base)).status,200);assert.equal((await f.call('getReleaseExport',who(j))).state,'QUEUED');assert.equal((await fetch(base+'/download')).status,409);
 const listing=await fetch(origin+'/api/v1/releases/'+f.publication.releaseId+'/exports?limit=1');assert.equal(listing.status,200);assert.equal((await listing.json()).jobs[0].exportId,j.exportId);
 assert.equal((await fetch(base,{headers:{'x-test-principal':'unknown'}})).status,404);
 await f.exporter().advance('user_1',j.exportId);const download=await fetch(base+'/download');assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/zip');assert(download.headers.get('content-disposition').startsWith('attachment;'));assert.equal(download.headers.get('x-content-type-options'),'nosniff');assert.equal(hash(new Uint8Array(await download.arrayBuffer())),(await f.call('getReleaseExport',who(j))).archiveHash);
 assert.equal((await fetch(base+'/download',{headers:{Range:'bytes=0-10'}})).status,416);assert.equal((await fetch(base+'?unexpected=1')).status,422);
 f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');assert.equal((await fetch(base+'/download')).status,404);await assert.rejects(f.exportContent().readBytes('user_1',{kind:'releaseExport',exportId:j.exportId}),{code:'RESOURCE_NOT_FOUND'});
});

test('ZIP filenames, collisions, determinism and platform record redaction',()=>{
 for(const path of ['../a','/a','a/../b','C:/a','a\\b','CON.txt','a/aux','a.','a ','a//b','a\0b','e\u0301'])assert.throws(()=>exportPath(path),{code:'EXPORT_PATH_INVALID'});
 for(const paths of [['a','A'],['a','a/b']])assert.throws(()=>buildExportZip(paths.map(path=>({path,bytes:Buffer.from('x')}))),{code:'EXPORT_PATH_COLLISION'});
 const files=[{path:'a',bytes:Buffer.from('test')},{path:'中文.md',bytes:Buffer.from('正文')}];assert.deepEqual(buildExportZip(files),buildExportZip(files.toReversed()));assert.equal(unpack(buildExportZip(files)).size,2);
 assert.deepEqual(redactExportRecord({content:'Bearer private-secret',apiKey:'drop',credentialRef:'drop',reasoning_content:'drop',nested:{password:'drop',visible:'retained'}}),{content:'Bearer [REDACTED]',nested:{visible:'retained'}});
 assert.deepEqual(JSON.parse(redactExportRecord(JSON.stringify({arguments:JSON.stringify({permit:{authority:'drop'},visible:'retained'}),thinking:'drop'}))),{arguments:JSON.stringify({visible:'retained'})});
});
