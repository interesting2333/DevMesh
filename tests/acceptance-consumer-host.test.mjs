// Real foundation start/stop, layout/CAS verification and file-backed Worker.
// Upstream source/Runner and backend physical observations are explicit fixtures.
import test from 'node:test';import assert from 'node:assert/strict';
import {backup} from 'node:sqlite';import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,cp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
import {loadConfig,startPlatform} from '../packages/platform-core/dist/index.mjs';
import {openLocalStorage,LocalContentStore} from '../packages/blob-store/dist/index.mjs';
import {acceptanceFixture} from './fixtures/acceptance.mjs';
import {explicitAcceptanceBackend} from './fixtures/acceptance-readiness.mjs';
import {hash,canonical} from './fixtures/storage-data.mjs';
const barrier=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
const bound=(f,backend)=>({projectId:f.p.projectId,policyHash:f.policyHash,principalId:f.policy.backendPrincipalId,backendRef:f.policy.backendRef,runnerId:f.policy.runnerId,backend});
async function hostSeed(t){
 const f=await acceptanceFixture(t),p=await f.call('beginAcceptancePreparation',await f.request()),root=await mkdtemp(join(tmpdir(),'devmesh-acceptance-host-'));let server;
 t.after(async()=>{await server?.stop();await rm(root,{recursive:true,force:true});});
 const options={dataRoot:join(root,'control'),backupRoot:join(root,'backup'),runnerDataRoot:join(root,'runner'),storeId:f.get('SELECT store_id FROM store_metadata').store_id,minimumFreeBytes:0},empty=await openLocalStorage({...options,initialize:true});await empty.close();
 await backup(f.db,join(options.dataRoot,'db','devmesh.sqlite'));await cp(join(f.content.dataRoot,'artifacts'),join(options.dataRoot,'artifacts'),{recursive:true});
 // Original raw fixture content predates the CAS-backed candidate pipeline.
 // Materialize only these exact known bytes; unknown missing hashes fail below.
 for(const value of ['用户需求原文',canonical(f.draft)]){const bytes=Buffer.from(value),digest=hash(bytes),dir=join(options.dataRoot,'artifacts','sha256',digest.slice(0,2));await mkdir(dir,{recursive:true});await writeFile(join(dir,digest),bytes);}
 const local=await openLocalStorage(options);try{assert.deepEqual((await new LocalContentStore(local.storage,local.dataRoot,0).verifyAll()).failures,[]);}finally{await local.close();}
 const repositoryRoot=fileURLToPath(new URL('../',import.meta.url)),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim(),file=join(root,'config.json');await writeFile(file,JSON.stringify({host:'127.0.0.1',port:0,storage:options,inputApi:{enabled:true,repositoryRoot,commit}}));
 return {f,p,options,config:loadConfig({},file),async start(extra){server=await startPlatform(loadConfig({},file),extra);return server;}};
}

test('host has no default acceptance consumer and rejects invalid explicit scopes while releasing storage for restart',{timeout:240000},async t=>{
 const h=await hostSeed(t),{f,p}=h,policies={[f.p.projectId]:f.policyHash},backend=explicitAcceptanceBackend(),server=await h.start({acceptancePolicies:policies});assert.equal(server.acceptancePreparation,undefined);
 const original=await server.services.local.storage.request('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId});assert.equal(original.state,'PREPARED');assert.equal((await server.services.local.storage.request('getAcceptanceReadiness',{principalId:'user_1',operationId:p.operationId,requestHash:p.requestHash})).sequence,0);await server.stop();
 let factories=0;const factory=()=>{factories++;return {bindings:[bound(f,backend)]};};await assert.rejects(startPlatform({...h.config,inputApi:undefined},{acceptancePreparation:factory}),/Acceptance preparation requires/);assert.equal(factories,0);
 for(const patch of [{principalId:'user_1'},{runnerId:'runner.foreign'},{policyHash:'f'.repeat(64)},{projectId:'prj_foreign'}]){
  await assert.rejects(h.start({acceptancePolicies:policies,acceptancePreparation:()=>({bindings:[{...bound(f,backend),...patch}]})}));
  const reopened=await openLocalStorage(h.options);await reopened.close();
 }
 assert.deepEqual(backend.counts,{preflight:0,prepare:0,inspect:0});
});

test('host snapshots acceptance policies, revokes new authorization on stop and drains the real call before storage closes',{timeout:240000},async t=>{
 const entered=barrier(),release=barrier();t.after(()=>release.resolve());const h=await hostSeed(t),{f,p}=h,policies={[f.p.projectId]:f.policyHash},backend=explicitAcceptanceBackend();let authorizedAfterStop;
 backend.prepare=async(_p,authorize)=>{backend.counts.prepare++;entered.resolve();await release.promise;authorizedAfterStop=await authorize();return {state:'UNKNOWN',errorCode:'FIXTURE_HOST_ORIGINAL_UNCERTAIN',checkedAt:new Date().toISOString()};};
 const server=await h.start({identityResolver:()=>({principalId:'user_1'}),acceptancePolicies:policies,acceptancePreparation:()=>{policies[f.p.projectId]='f'.repeat(64);return {bindings:[bound(f,backend)],pollIntervalMs:1000};}});await entered.promise;
 const origin='http://127.0.0.1:'+server.address.port,basis=await fetch(origin+'/api/v1/runs/'+p.runId+'/candidates/'+p.candidateId+'/acceptance');assert.equal(basis.status,200);assert.equal((await basis.json()).policyHash,f.policyHash);assert.ok(server.acceptancePreparation);
 const stopping=server.stop();assert.equal(server.stop(),stopping);let drained=false;void stopping.then(()=>{drained=true;});await Promise.resolve();assert.equal(drained,false);assert.ok(await server.services.local.storage.request('getRun',{runId:p.runId}));release.resolve();await stopping;assert.equal(authorizedAfterStop,false);assert.equal(backend.counts.prepare,1);await assert.rejects(server.services.local.storage.request('getRun',{runId:p.runId}));
 const local=await openLocalStorage(h.options);try{assert.equal((await local.storage.request('getAcceptancePreparation',{principalId:'user_1',operationId:p.operationId})).state,'SENT');const ready=await local.storage.request('getAcceptanceReadiness',{principalId:'user_1',operationId:p.operationId,requestHash:p.requestHash});assert.equal(ready.reasonCode,'FIXTURE_HOST_ORIGINAL_UNCERTAIN');assert.equal((await local.storage.request('getRun',{runId:p.runId})).terminalOutcome,null);}finally{await local.close();}
 const nextBackend=explicitAcceptanceBackend(),restarted=await h.start({acceptancePolicies:{[f.p.projectId]:f.policyHash},acceptancePreparation:()=>({bindings:[bound(f,nextBackend)]})});await restarted.acceptancePreparation.tick();await restarted.stop();assert.equal(nextBackend.counts.prepare,0);assert.equal(nextBackend.counts.inspect,1);
});
