import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { openLocalStorage } from '../packages/blob-store/dist/index.mjs';
import { startPlatform,loadConfig } from '../packages/platform-core/dist/index.mjs';
import { contentFixture,currentSchemaVersion } from './fixtures/content-data.mjs';

test('failed initialization resumes only explicitly and retains its original store identity',async t=>{
  const f=await contentFixture(t),options={...f.options,dataRoot:join(f.root,'capacity-control'),minimumFreeBytes:Number.MAX_SAFE_INTEGER};
  await assert.rejects(openLocalStorage({...options,initialize:true}),e=>e.code==='STORAGE_CAPACITY');
  const pending=JSON.parse(readFileSync(join(options.dataRoot,'storage-layout.initializing.json'),'utf8'));
  await assert.rejects(openLocalStorage({...options,minimumFreeBytes:0}),e=>e.code==='LAYOUT_UNRECOGNIZED');
  const resumed=await openLocalStorage({...options,minimumFreeBytes:0,initialize:true});
  try{assert.equal(resumed.marker.storeId,pending.storeId);assert.equal(existsSync(join(options.dataRoot,'storage-layout.initializing.json')),false);}finally{await resumed.close();}
});

test('HTTP composition verifies stored content before readiness and disposes its database and node lock',async t=>{
  const f=await contentFixture(t);await f.local.close();
  const configPath=join(f.root,'server.json');writeFileSync(configPath,JSON.stringify({host:'127.0.0.1',port:0,shutdownTimeoutMs:1000,storage:f.options}));
  const config=loadConfig({},configPath);assert.equal(config.storageSources.dataRoot,'file');
  const server=await startPlatform(config);
  try{
    assert.ok(server.services);assert.equal(server.services.local.marker.storeId,f.local.marker.storeId);
    const response=await fetch(`http://127.0.0.1:${server.address.port}/readyz`);assert.equal(response.status,200);await response.json();
  }finally{await server.stop();}
  await f.reopen();assert.equal((await f.storage.request('inspect',{})).version,currentSchemaVersion);
});

test('maintenance CLI verifies an existing store, refuses implicit creation and releases resources before exit',async t=>{
  const f=await contentFixture(t);await f.local.close();
  const configPath=join(f.root,'cli.json'),script=fileURLToPath(new URL('../scripts/storage.mjs',import.meta.url));
  const run=async(command,options)=>{
    writeFileSync(configPath,JSON.stringify({storage:options}));
    const child=spawn(process.execPath,[script,command,'--config',configPath],{stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>{out+=b;});child.stderr.on('data',b=>{err+=b;});const [code]=await once(child,'exit');return {code,out,err};
  };
  const verified=await run('verify',f.options);assert.equal(verified.code,0,verified.err);assert.equal(JSON.parse(verified.out).status,'PASSED');
  await f.reopen();await f.local.close();
  const fresh={...f.options,dataRoot:join(f.root,'cli-new')};
  const missing=await run('verify',fresh);assert.equal(missing.code,1);assert.equal(existsSync(fresh.dataRoot),false);
  const created=await run('init',fresh);assert.equal(created.code,0,created.err);assert.equal(JSON.parse(created.out).database.version,currentSchemaVersion);
});
