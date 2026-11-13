import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {LocalContentStore} from '../packages/blob-store/dist/index.mjs';
import {mountInputApi} from '../packages/input-api/dist/index.mjs';
import {releaseGatewayConfiguration} from '../packages/preview-gateway/dist/index.mjs';
import {releaseHttpFixture} from './fixtures/release-http.mjs';
const express=createRequire(new URL('../packages/input-api/package.json',import.meta.url))('express');
test('Release HTTPS entry binds current published identity and one-send writable business HTTP',{timeout:480000},async t=>{
 const app=express(),server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 let api; t.after(async()=>{await api?.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 let lostAck=false;
 const f=await releaseHttpFixture(t,{gatewayOptions:{platformOrigin:origin},storageWrap:storage=>({async request(method,input){const result=await storage.request(method,input);if(lostAck&&method==='beginReleaseAccessRequest'){lostAck=false;throw Error('explicit lost dispatch ACK');}return result;}})}),before=f.mutations(),q=f.publication.request.preparation;
 api=mountInputApi(app,new LocalContentStore(f.control.storage,f.data.root,0),{enabled:true,baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},identityResolver:req=>req.headers.authorization==='Bearer release-owner'?{principalId:'user_1'}:req.headers.authorization==='Bearer release-outsider'?{principalId:'outside'}:null,releaseGateway:f.gateway});
 const path=`/api/v1/runs/${q.runId}/releases/${q.releaseId}`,call=async(p=path,o={})=>{const r=await fetch(origin+p,{...o,headers:{authorization:'Bearer release-owner',...o.headers},signal:AbortSignal.timeout(20000)});const text=await r.text();return {status:r.status,headers:r.headers,text,body:r.headers.get('content-type')?.includes('application/json')?JSON.parse(text):null};};
 const login=await f.login(),write=(url,body,key=randomUUID())=>f.request(login.origin,url,{method:'POST',headers:{cookie:login.cookie,origin:login.origin,'content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)});
 await t.test('platform GET checks live service but mints no credential and hides internal endpoints',async()=>{
  const count=f.control.get('SELECT count(*) n FROM release_tickets').n,view=await call();assert.equal(view.status,200,view.text);assert.equal(view.body.access.state,'AVAILABLE');assert.equal(view.body.access.canWrite,true);assert.equal(view.text.includes('endpoint'),false);assert.equal(view.text.includes('instanceId'),false);
  const page=await call(path+'/view');assert.equal(page.status,200);assert.match(page.text,/sandbox="allow-scripts allow-forms allow-same-origin"/);assert.match(page.headers.get('content-security-policy'),/script-src 'nonce-/);assert.equal(f.control.get('SELECT count(*) n FROM release_tickets').n,count);
  assert.equal((await call(path,{headers:{authorization:'Bearer release-outsider'}})).status,404);assert.equal((await call(path+'?target=https://example.com')).status,422);
  assert.equal((await call(path+'/access',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,403);assert.equal((await call(path+'/access',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{"principalId":"user_1"}'})).status,422);
  const issued=await call(path+'/access',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});assert.equal(issued.status,200,issued.text);assert.match(issued.body.ticket,/^dmr_ticket\./);assert.equal((await f.exchange(issued.body)).status,200);
 });
 await t.test('actual CRUD is accounted once; PREVIEW credentials, cross-origin writes and upstream cookies are refused',async()=>{
  assert.match(login.cookie,/^__Host-devmesh-release=dmr_session\./);assert.match(login.response.headers['set-cookie'][0],/Secure; HttpOnly; SameSite=None/);
  const probe=await f.request(login.origin,'/__devmesh/release/session',{headers:{origin,cookie:login.cookie}});assert.equal(probe.status,200);assert.equal((await f.request(login.origin,'/api/tasks',{headers:{cookie:login.cookie.replace('dmr_session','dmp_session')}})).status,401);
  const key=randomUUID(),data={title:'Release over TLS',description:'',status:'todo'},created=await write('/api/tasks',data,key);assert.equal(created.status,201,created.body);assert.equal((await write('/api/tasks',data,key)).status,409);const rows=await f.request(login.origin,'/api/tasks',{headers:{cookie:login.cookie}});assert.equal(JSON.parse(rows.body).tasks.filter(x=>x.title===data.title).length,1);
  const echo=await f.request(login.origin,'/__test/echo',{headers:{cookie:login.cookie}});assert.equal(echo.status,200);assert.equal(echo.headers['set-cookie'],undefined);assert.equal(echo.headers.location,undefined);assert.equal(JSON.parse(echo.body).headers.cookie,undefined);
  assert.equal((await f.request(login.origin,'/api/tasks',{method:'POST',headers:{cookie:login.cookie,origin:'https://external.example','idempotency-key':randomUUID(),'content-type':'application/json'},body:JSON.stringify(data)})).status,403);
 });
 await t.test('live guard/health/route/instance changes fail closed with no new physical actions',async()=>{
  f.driver.unhealthy=true;assert.equal((await call()).body.access.state,'RECOVERING');assert.equal((await f.request(login.origin,'/api/tasks',{headers:{cookie:login.cookie}})).status,502);f.driver.unhealthy=false;
  const j=await f.current(),guard=f.guards.get(j.reservation.reservationId);f.guards.delete(j.reservation.reservationId);assert.equal((await call()).body.access.state,'RECOVERING');f.guards.set(j.reservation.reservationId,guard);
  const route=f.bindings.get(q.releaseId);f.bindings.set(q.releaseId,{...route,generation:route.generation+1});assert.equal((await call()).body.access.state,'RECOVERING');f.bindings.set(q.releaseId,route);
  const container=f.driver.containers.get(j.profile.containerName);f.driver.containers.set(j.profile.containerName,{...container,containerId:'f'.repeat(64)});assert.equal((await call()).body.access.state,'RECOVERING');f.driver.containers.set(j.profile.containerName,container);assert.equal((await call()).body.access.state,'AVAILABLE');assert.deepEqual(f.mutations(),before);
 });
 await t.test('lost dispatch ACK makes zero business requests and does not resend its consumed grant',async()=>{
  const key=randomUUID(),input={title:'Must never send',description:'',status:'todo'};lostAck=true;const response=await write('/api/tasks',input,key);assert.equal(response.status,503);assert.equal(f.rows().at(-1).state,'DISPATCHED');assert.equal((await write('/api/tasks',input,key)).status,409);assert.equal((await fetch(f.origin+'/api/tasks').then(r=>r.json())).tasks.some(r=>r.title===input.title),false);assert.equal(f.control.get('SELECT count(*) n FROM business_pending_writes').n,1);
 });
 await t.test('lost response after real committed write stays UNKNOWN, blocks shared barrier and is never resent',async()=>{
  const key=randomUUID(),input={title:'Unknown Release write',description:'',status:'todo'},result=await write('/__test/drop-after-write',input,key);assert.equal(result.status,502,result.body);assert.equal(JSON.parse(result.body).error,'RELEASE_HTTP_OUTCOME_UNKNOWN');assert.equal((await write('/__test/drop-after-write',input,key)).status,409);assert.equal(f.received.filter(r=>r.path==='/__test/drop-after-write').length,1);
  assert.equal(f.control.get('SELECT count(*) n FROM business_pending_writes').n,2);assert.equal((await f.control.call('getReleaseWriteGate',{principalId:'user_1',releaseId:q.releaseId})).pendingWrites,2);assert.equal((await fetch(f.origin+'/api/tasks').then(r=>r.json())).tasks.filter(r=>r.title===input.title).length,1);
 });
 await t.test('viewer loses writes and membership revocation withholds an already completed response',async()=>{
  f.control.run("UPDATE project_members SET role='viewer' WHERE principal_id='user_1'");assert.equal((await call()).body.access.canWrite,false);assert.equal((await write('/api/tasks',{title:'denied',description:'',status:'todo'})).status,403);f.control.run("UPDATE project_members SET role='owner' WHERE principal_id='user_1'");
  const response=f.request(login.origin,'/__test/in-flight',{headers:{cookie:login.cookie}});await f.blocked;f.control.run("DELETE FROM project_members WHERE principal_id='user_1'");f.releaseResponse();const withheld=await response;assert.equal(withheld.status,404);assert.equal(withheld.body.includes('private in-flight release content'),false);assert.equal((await call()).status,404);assert.equal(f.rows().at(-1).state,'FINISHED');assert.deepEqual(f.mutations(),before);
 });
 assert.throws(()=>releaseGatewayConfiguration({...f.gateway.config,platformOrigin:'https://control.devmesh.test',releaseBaseOrigin:'https://apps.devmesh.test'}));
});
