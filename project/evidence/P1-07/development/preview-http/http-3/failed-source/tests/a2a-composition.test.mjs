import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { startPlatform,loadConfig } from '../packages/platform-core/dist/index.mjs';
import { contentFixture } from './fixtures/content-data.mjs';
import { manifest,credential,serviceToken,prepareDispatch,SendMessageRequest } from './fixtures/a2a-data.mjs';
import { ClientFactory,JsonRpcTransportFactory } from '../packages/a2a-adapter/node_modules/@a2a-js/sdk/dist/client/index.js';

async function port(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('platform listens before card self-check and opens admission after committed projection',async t=>{
 let platform;t.after(async()=>{await platform?.stop();});
 const f=await contentFixture(t);await f.local.close();const p=await port(),base='http://127.0.0.1:'+p,m=manifest(base);let release;const gate=new Promise(r=>{release=r;});let reached;
 const blocked=new Promise(r=>{reached=r;});let holding=true;
 const launching=startPlatform({host:'127.0.0.1',port:p,shutdownTimeoutMs:500,storage:f.options,a2a:{manifest:m,identities:[{principalId:'orchestrator',credentialRef:'test.service'}]}},{resolveCredential:async ref=>{if(holding){reached();await gate;}return credential(ref);}});
 await blocked;assert.equal((await fetch(base+'/healthz')).status,200);assert.equal((await fetch(base+'/readyz')).status,503);
 holding=false;release();platform=await launching;assert.equal((await fetch(base+'/readyz')).status,200);
 const snapshot=await platform.services.local.storage.request('getRegistrySnapshot',{});assert.equal(snapshot.endpoints.filter(e=>e.status==='HEALTHY').length,4);
 // Exercise the production composition with official client and actual persisted dispatch.
 const ctx=await prepareDispatch({...f,storage:platform.services.local.storage,content:platform.services.content},platform.agents.registry);
 const fetched=(url,init)=>fetch(url,{...init,headers:{...Object.fromEntries(new Headers(init?.headers)),Authorization:'Bearer '+serviceToken}});
 const client=await new ClientFactory({transports:[new JsonRpcTransportFactory({fetchImpl:fetched})]}).createFromAgentCard(platform.agents.handlers.get('builtin.developer').card);
 const reply=await client.sendMessage(SendMessageRequest.fromJSON(SendMessageRequest.toJSON(ctx.params)));assert.ok(reply.id);
 await platform.stop();await f.reopen();assert.equal((await f.storage.request('inspect',{})).counts.a2a_tasks,1);
});
test('unconfigured service credentials keep every endpoint unavailable without bypassing auth',async t=>{
 let platform;t.after(async()=>{await platform?.stop();});
 const f=await contentFixture(t);await f.local.close();const p=await port(),base='http://127.0.0.1:'+p;
 platform=await startPlatform({host:'127.0.0.1',port:p,shutdownTimeoutMs:500,storage:f.options,a2a:{manifest:manifest(base),identities:[]}},{resolveCredential:async()=>undefined});
 assert.equal((await fetch(base+'/internal/agents/developer/agent-card.json')).status,401);
 await assert.rejects(platform.agents.registry.resolveRole('developer'),e=>e.code==='ENDPOINT_UNAVAILABLE');
});
test('configuration resolves one explicit manifest path and rejects private or duplicate fields',async t=>{
 const f=await contentFixture(t),m=manifest(),config=join(f.root,'server.json');writeFileSync(join(f.root,'agents.json'),JSON.stringify(m));
 writeFileSync(config,JSON.stringify({a2a:{manifestPath:'agents.json',identities:[]}}));assert.equal(loadConfig({},config).a2a.manifest.manifestRevision,'M1');
 writeFileSync(config,JSON.stringify({a2a:{manifestPath:'agents.json',identities:[],token:'forbidden-inline-secret'}}));assert.throws(()=>loadConfig({},config));
});
