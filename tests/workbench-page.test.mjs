import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

const get=(f,path,headers={authorization:'Bearer test_owner'})=>fetch(f.origin+'/api/v1'+path,{headers});
test('workbench page and bundled client require configured trusted identity; GET creates no input facts',{timeout:120000},async t=>{
 const f=await inputFixture(t),before=await f.storage.request('inspect',{});
 assert.equal((await get(f,'/workbench/view',{})).status,401);
 const page=await get(f,'/workbench/view'),html=await page.text();assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');assert.equal(page.headers.get('x-content-type-options'),'nosniff');assert.equal(page.headers.get('referrer-policy'),'no-referrer');
 const policy=page.headers.get('content-security-policy'),nonce=html.match(/<style nonce="([^"]+)"/)[1];assert(policy.includes("script-src 'nonce-"+nonce+"'"));assert(policy.includes("default-src 'none'"));assert(policy.includes("connect-src 'self'"));assert(policy.includes("form-action 'none'"));assert(html.includes('src="/api/v1/workbench/client.js"'));assert.deepEqual(JSON.parse(html.match(/id="workbench-data"[^>]*>(.*?)<\/script>/s)[1]),{principalId:'user_1',selection:null});
 const client=await get(f,'/workbench/client.js');assert.equal(client.status,200);assert(client.headers.get('content-type').includes('application/javascript'));assert((await client.text()).length>10000);
 assert.equal((await get(f,'/workbench/client.js?unexpected=1')).status,422);assert.deepEqual((await f.storage.request('inspect',{})).counts,before.counts);
 const missing=await inputFixture(t,{identityResolver:undefined});assert.equal((await get(missing,'/workbench/view')).status,503);
 const disabled=await inputFixture(t,{enabled:false});assert.equal((await get(disabled,'/workbench/view')).status,404);
});

test('selected workbench rejects malformed or foreign scopes and rechecks membership after asynchronous read',{timeout:120000},async t=>{
 const f=await inputFixture(t),a=(await f.create({name:'A'})).body.result,b=(await f.create({name:'B'})).body.result;
 const selected=await get(f,`/workbench/view?projectId=${a.projectId}&runId=${a.runId}`);assert.equal(selected.status,200);const html=await selected.text();assert(html.includes(a.projectId));assert(!html.includes('原始需求'));
 for(const query of [`runId=${a.runId}`,`projectId=${a.projectId}&projectId=${b.projectId}`,`projectId=${a.projectId}&unknown=1`])assert.equal((await get(f,'/workbench/view?'+query)).status,422);
 assert.equal((await get(f,`/workbench/view?projectId=${a.projectId}&runId=${b.runId}`)).status,404);assert.equal((await get(f,`/workbench/view?projectId=${a.projectId}`,{authorization:'Bearer test_other'})).status,404);
 const original=f.storage.request.bind(f.storage);let revoked=false;
 f.storage.request=async(name,args)=>{const result=await original(name,args);if(name==='getInputWorkspace'&&!revoked){revoked=true;f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',a.projectId,'user_1');}return result;};
 const lost=await get(f,`/workbench/view?projectId=${a.projectId}`);assert.equal(lost.status,404);assert(!(await lost.text()).includes('workbench-data'));assert(revoked);
});

test('expected page principal is a guard before JSON parsing and side effects, never an identity credential',{timeout:120000},async t=>{
 const f=await inputFixture(t),body={initialRequest:{text:'旧账号草稿',attachmentIds:[]},clientDraftId:randomUUID()},before=(await f.storage.request('inspect',{})).counts;
 const mismatch=await f.call('/projects',{method:'POST',headers:{authorization:'Bearer test_other','x-devmesh-principal':'user_1','content-type':'application/json','idempotency-key':randomUUID()},body:'{broken'});assert.equal(mismatch.response.status,403);assert.equal(mismatch.body.error.code,'FORBIDDEN');assert.deepEqual((await f.storage.request('inspect',{})).counts,before);
 assert.equal((await get(f,'/workbench/view',{'x-devmesh-principal':'user_1'})).status,401);
 assert.equal((await get(f,'/projects',{authorization:'Bearer test_owner','x-devmesh-principal':'invalid principal'})).status,422);
 const duplicate=await new Promise((resolve,reject)=>{const q=httpRequest(f.origin+'/api/v1/projects',{headers:['Host',new URL(f.origin).host,'Authorization','Bearer test_owner','X-DevMesh-Principal','user_1','X-DevMesh-Principal','user_1']},r=>{r.resume();r.once('end',()=>resolve(r.statusCode));});q.once('error',reject);q.end();});assert.equal(duplicate,400);
 const good=await f.call('/projects',{method:'POST',headers:{'x-devmesh-principal':'user_1','content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify(body)});assert.equal(good.response.status,201,JSON.stringify(good.body));assert.equal((await f.create()).response.status,201);assert.equal(f.sql('SELECT count(*) n FROM projects')[0].n,2);
});
