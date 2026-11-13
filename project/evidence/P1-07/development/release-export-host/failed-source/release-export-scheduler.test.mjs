import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdir,cp,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {backup} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {ReleaseExportScheduler,startPlatform,loadConfig} from '../packages/platform-core/dist/index.mjs';
import {releaseExportFixture} from './fixtures/release-export.mjs';
import {hash,canonical,meta} from './fixtures/storage-data.mjs';

const subject=j=>({principalId:'user_1',exportId:j.exportId});
async function until(fn){const end=Date.now()+30000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(20);}throw Error('Export scheduler condition not observed');}
const facts=f=>canonical(Object.fromEntries(['releases','acceptance_commits','release_promotion_outbox','release_publications','projects','runs'].map(table=>[table,f.db.prepare('SELECT * FROM '+table).all()])));
const options={pollIntervalMs:100,maxConcurrentJobs:2,maxJobsPerPass:32};

test('private export scan paginates eligible originals and excludes live, terminal and revoked jobs',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),a=await f.create(),b=await f.create(),expired=await f.create(),live=await f.create(),failed=await f.create(),ready=await f.create();
  await f.call('claimReleaseExport',subject(expired));f.run('UPDATE release_exports SET lease_until=? WHERE export_id=?','2000-01-01T00:00:00.000Z',expired.exportId);
  await f.call('claimReleaseExport',subject(live));const claim=await f.call('claimReleaseExport',subject(failed));await f.call('failReleaseExport',{...subject(failed),generation:claim.generation,claimToken:claim.claimToken,errorCode:'EXPLICIT_FAILURE'});
  assert.equal((await f.exporter().advance('user_1',ready.exportId)).state,'READY');
  const jobs=[];let cursor;do{const page=await f.call('listReleaseExportWork',{limit:1,...(cursor?{afterExportId:cursor}:{})});jobs.push(...page.jobs);cursor=page.nextCursor;}while(cursor);
  assert.deepEqual(jobs.map(j=>j.exportId).sort(),[a,b,expired].map(j=>j.exportId).sort());assert(jobs.every(j=>Object.keys(j).sort().join(',')==='exportId,generation,principalId,state'));
  f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');assert.deepEqual(await f.call('listReleaseExportWork',{}),{jobs:[],nextCursor:null});
});

test('two consumers use real DB claims, coalesce ticks, bound concurrency and pack every original once',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),jobs=await Promise.all(Array.from({length:4},()=>f.create())),before=facts(f),gate=Promise.withResolvers();let active=0,max=0,reads=0;
  t.after(()=>gate.resolve());
  const sources={async read(context,signal){reads++;active++;max=Math.max(max,active);try{await gate.promise;signal.throwIfAborted();return await f.sources.read(context,signal);}finally{active--;}}};
  const a=new ReleaseExportScheduler(f.exportContent(),sources,{...options,maxConcurrentJobs:1}),b=new ReleaseExportScheduler(f.exportContent(),sources,{...options,maxConcurrentJobs:1});t.after(()=>Promise.all([a.stop(),b.stop()]));
  const first=a.tick();assert.equal(a.tick(),first);const second=b.tick();await until(()=>active===2);assert.equal(max,2);gate.resolve();await Promise.all([first,second]);await a.tick();
  for(const j of jobs){const ready=await f.call('getReleaseExport',subject(j));assert.equal(ready.state,'READY');assert.equal(ready.generation,1);assert.equal(f.get("SELECT count(*) n FROM release_export_history WHERE export_id=? AND state='PACKING'",j.exportId).n,1);}
  assert.equal(reads,4);assert.equal(facts(f),before);
});

test('terminated Worker leaves the original lease; restarted consumer resumes only after expiry',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),j=await f.create(),old=await f.call('claimReleaseExport',subject(j)),before=facts(f);
  await f.crash();await f.reopen();const scheduler=new ReleaseExportScheduler(f.exportContent(),f.sources,options);t.after(()=>scheduler.stop());
  await scheduler.tick();assert.equal((await f.call('getReleaseExport',subject(j))).generation,1);
  f.run('UPDATE release_exports SET lease_until=? WHERE export_id=?','2000-01-01T00:00:00.000Z',j.exportId);scheduler.start();
  const ready=await until(async()=>{const v=await f.call('getReleaseExport',subject(j));return v.state==='READY'&&v;});await scheduler.stop();
  assert.equal(ready.generation,2);assert.equal(ready.snapshotHash,j.snapshotHash);assert.equal(ready.cutoffSeq,j.cutoffSeq);assert.equal(f.get('SELECT count(*) n FROM release_exports').n,1);assert.equal(facts(f),before);
  await assert.rejects(f.call('getReleaseExportContext',{...subject(j),generation:1,claimToken:old.claimToken}),{code:'EXPORT_CLAIM_STALE'});
});

test('failed packing does not auto-retry; explicit original retry is consumed without repeating acceptance',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),j=await f.create(),before=facts(f);let reads=0,available=false;
  const scheduler=new ReleaseExportScheduler(f.exportContent(),{async read(c,s){reads++;if(!available)throw Error('Explicit source unavailable');return f.sources.read(c,s);}},options);t.after(()=>scheduler.stop());scheduler.start();
  const failed=await until(async()=>{const v=await f.call('getReleaseExport',subject(j));return v.state==='FAILED'&&v;});await delay(250);assert.equal(reads,1);assert.equal(facts(f),before);
  available=true;await f.call('retryReleaseExport',{...subject(j),expectedGeneration:failed.generation});const ready=await until(async()=>{const v=await f.call('getReleaseExport',subject(j));return v.state==='READY'&&v;});await scheduler.stop();
  assert.equal(reads,2);assert.equal(ready.snapshotHash,j.snapshotHash);assert.equal(facts(f),before);
});

test('shutdown cancels and drains the actual in-flight pack before closing storage',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),j=await f.create(),entered=Promise.withResolvers(),release=Promise.withResolvers();t.after(()=>release.resolve());let readSignal;
  const scheduler=new ReleaseExportScheduler(f.exportContent(),{async read(c,s){readSignal=s;entered.resolve();await release.promise;s.throwIfAborted();return f.sources.read(c,s);}},options);t.after(()=>scheduler.stop());scheduler.start();await entered.promise;
  let stopped=false;const stopping=scheduler.stop().then(()=>{stopped=true;});await delay(30);assert(readSignal.aborted);assert.equal(stopped,false);assert.equal((await f.call('getReleaseExport',subject(j))).state,'PACKING');
  release.resolve();await stopping;assert.equal((await f.call('getReleaseExport',subject(j))).state,'FAILED');assert.equal(scheduler.lastError,'EXPORT_INTERRUPTED');const later=await f.create();await scheduler.tick();assert.equal((await f.call('getReleaseExport',subject(later))).state,'QUEUED');
});

test('membership removed during packing prevents publication and subsequent private scans',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),j=await f.create(),entered=Promise.withResolvers(),release=Promise.withResolvers();t.after(()=>release.resolve());
  const scheduler=new ReleaseExportScheduler(f.exportContent(),{async read(c,s){entered.resolve();await release.promise;return f.sources.read(c,s);}},options);t.after(()=>scheduler.stop());const packing=scheduler.tick();await entered.promise;
  f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');release.resolve();await packing;
  assert.equal(f.get('SELECT state FROM release_exports WHERE export_id=?',j.exportId).state,'PACKING');assert.equal(f.get('SELECT content_hash FROM release_exports WHERE export_id=?',j.exportId).content_hash,null);assert.equal(scheduler.lastError,'RESOURCE_NOT_FOUND');assert.deepEqual(await f.call('listReleaseExportWork',{}),{jobs:[],nextCursor:null});
});

test('scan failure keeps the timer alive without persisting private error text',{timeout:120000},async t=>{
  const f=await releaseExportFixture(t),j=await f.create(),storage=f.storage,request=storage.request.bind(storage);let scans=0;
  storage.request=async(m,i)=>{if(m==='listReleaseExportWork'&&++scans===1)throw Error('private path and claim must never surface');return request(m,i);};
  const scheduler=new ReleaseExportScheduler(f.exportContent(),f.sources,options);t.after(()=>scheduler.stop());scheduler.start();await until(async()=>(await f.call('getReleaseExport',subject(j))).state==='READY');await scheduler.stop();assert(scans>=2);assert.equal(scheduler.lastError,'EXPORT_SCAN_UNAVAILABLE');
});

// A formal accepted-release protocol fixture plus actual Worker/CAS/Git, copied
// into an explicitly seeded control-layout fixture. This is not backup restore,
// actual generated-image qualification, OIDC or a physical deployment test.
async function hostedFixture(f){
  const dataRoot=join(f.exportRoot,'control'),backupRoot=join(f.exportRoot,'backup');await mkdir(join(dataRoot,'db'),{recursive:true});await mkdir(join(dataRoot,'artifacts'),{recursive:true});
  await backup(f.db,join(dataRoot,'db','devmesh.sqlite'));await cp(join(f.exportContent().dataRoot,'artifacts','sha256'),join(dataRoot,'artifacts','sha256'),{recursive:true});
  await writeFile(join(dataRoot,'storage-layout.json'),JSON.stringify({layoutVersion:1,storeId:f.get('SELECT store_id FROM store_metadata').store_id,nodeKind:'control',createdAt:new Date().toISOString()}));
  const inputApi={enabled:true,repositoryRoot:process.cwd(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),templatePath:'templates/web-crud-v1'},path=join(f.exportRoot,'server.json');
  return async enabled=>{await writeFile(path,JSON.stringify({host:'127.0.0.1',port:0,storage:{dataRoot,backupRoot,minimumFreeBytes:0},inputApi,releaseExports:{enabled,...options}}));return loadConfig({},path);};
}

test('configured platform drains persisted and HTTP-queued exports across restart with default Git sources',{timeout:180000},async t=>{
  const f=await releaseExportFixture(t),j=await f.create(),config=await hostedFixture(f),start=async enabled=>{const server=await startPlatform(await config(enabled),{identityResolver:()=>({principalId:'user_1'})});t.after(()=>server.stop());return server;};
  const disabled=await start(false);assert.equal(disabled.releaseExports,undefined);assert.equal((await disabled.services.local.storage.request('getReleaseExport',subject(j))).state,'QUEUED');await disabled.stop();
  const server=await start(true),url='http://127.0.0.1:'+server.address.port;assert(server.releaseExports);assert.equal(server.consumer,undefined);assert.equal(server.agents,undefined);
  const read=id=>server.services.local.storage.request('getReleaseExport',{principalId:'user_1',exportId:id});const ready=await until(async()=>{const v=await read(j.exportId);return v.state==='READY'&&v;});
  const download=await fetch(url+'/api/v1/exports/'+j.exportId+'/download');assert.equal(download.status,200);assert.equal(hash(new Uint8Array(await download.arrayBuffer())),ready.archiveHash);
  await server.releaseExports.stop();const response=await fetch(url+'/api/v1/releases/'+j.releaseId+'/exports',{method:'POST',headers:{'content-type':'application/json','idempotency-key':meta().idempotencyKey},body:JSON.stringify({format:'zip'})});assert.equal(response.status,202);const next=await response.json();assert.equal((await read(next.exportId)).state,'QUEUED');await server.stop();
  const restarted=await start(true),get=()=>restarted.services.local.storage.request('getReleaseExport',{principalId:'user_1',exportId:next.exportId});const resumed=await until(async()=>{const v=await get();return v.state==='READY'&&v;});assert.equal(resumed.generation,1);assert.equal(resumed.snapshotHash,next.snapshotHash);assert.equal(resumed.archiveHash,ready.archiveHash);await restarted.stop();
});

test('export configuration requires an explicit flag and bounded local scheduling',{timeout:30000},async t=>{
  const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os');const root=await mkdtemp(join(tmpdir(),'devmesh-export-config-'));t.after(()=>rm(root,{recursive:true,force:true}));const path=join(root,'server.json');
  for(const bad of [null,[],{}, {enabled:'true'}, {enabled:true,pollIntervalMs:99}, {enabled:true,maxConcurrentJobs:3}, {enabled:true,maxJobsPerPass:201}, {enabled:true,sources:'arbitrary'}]){await writeFile(path,JSON.stringify({releaseExports:bad}));assert.throws(()=>loadConfig({},path));}
  await writeFile(path,JSON.stringify({releaseExports:{enabled:true}}));const config=loadConfig({},path);assert(Object.isFrozen(config.releaseExports));await assert.rejects(startPlatform(config),/durable storage/);
  await writeFile(path,JSON.stringify({releaseExports:{enabled:false}}));assert.equal(loadConfig({},path).releaseExports,undefined);assert.equal(JSON.parse(await readFile(path,'utf8')).releaseExports.enabled,false);
});
