import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {previewEntryFixture,previewFixtureIdentity} from './fixtures/preview-entry.mjs';
import {releaseFreezeFixture} from './fixtures/release-freeze.mjs';
import {mountInputApi} from '../packages/input-api/dist/index.mjs';
import {gatewayConfiguration} from '../packages/preview-gateway/dist/index.mjs';
const express=createRequire(new URL('../packages/input-api/package.json',import.meta.url))('express');

test('actual platform query and view never issue or accept; access binds resolved member and confirms the cross-site session', {timeout:120000}, async t=>{
  const f=await previewEntryFixture(t),before=f.accepted();
  assert.throws(()=>gatewayConfiguration({...f.gateway.config,mode:'shared',platformOrigin:'https://127.0.0.1',previewBaseOrigin:'https://apps.example.net'}));
  assert.throws(()=>gatewayConfiguration({...f.gateway.config,platformOrigin:'http://10.0.0.1:8080'}));
  const query=await f.call();assert.equal(query.status,200);assert.equal(query.body.access.state,'AVAILABLE');assert.equal(query.body.access.canWrite,true);
  assert.equal(query.text.includes('endpoint'),false);assert.equal(query.text.includes('instanceId'),false);
  const page=await f.call(f.path+'/view');assert.equal(page.status,200);assert.match(page.text,/sandbox="allow-scripts allow-forms allow-same-origin"/);assert.match(page.response.headers.get('content-security-policy'),/script-src 'nonce-/);
  assert.equal(f.sql('SELECT count(*) n FROM preview_tickets')[0].n,0);assert.deepEqual(f.accepted(),before);
  assert.equal((await f.call(f.path,{headers:{authorization:'Bearer fixture_preview_outsider'}})).status,404);
  assert.equal((await f.call(f.path,{headers:{authorization:'Bearer missing'}})).status,401);
  assert.equal((await f.call(f.path+'?target=https://external.example/')).status,422);
  const post={method:'POST',headers:{origin:f.origin,'content-type':'application/json'},body:'{}'};
  assert.equal((await f.call(f.path+'/access',{...post,headers:{'content-type':'application/json'}})).status,403);
  assert.equal((await f.call(f.path+'/access',{...post,body:JSON.stringify({principalId:'user_1'})})).status,422);
  const issued=await f.call(f.path+'/access',post);assert.equal(issued.status,200);assert.match(issued.body.ticket,/^dmp_ticket\./);
  const exchanged=await f.exchange(issued.body);assert.equal(exchanged.status,200);const cookie=exchanged.headers['set-cookie'][0].split(';')[0];
  const probe=await f.request(issued.body.previewOrigin,'/__devmesh/preview/session',{headers:{origin:f.origin,cookie}});
  assert.equal(probe.status,200);assert.equal(probe.headers['access-control-allow-origin'],f.origin);assert.deepEqual(Object.keys(JSON.parse(probe.body)),['expiresAt']);
  assert.equal((await f.request(issued.body.previewOrigin,'/__devmesh/preview/session',{headers:{origin:f.origin}})).status,401);
  assert.equal((await f.request(issued.body.previewOrigin,'/__devmesh/preview/session',{headers:{origin:'https://external.example',cookie}})).status,403);
  assert.deepEqual(f.accepted(),before);
});

test('preview query reports current health, read-only membership and revocation without minting authority', {timeout:120000}, async t=>{
  const f=await previewEntryFixture(t);
  await f.f.runtime(f.f.p,{state:'UNHEALTHY'});
  const recovering=await f.call();assert.equal(recovering.body.access.state,'UNKNOWN');assert.equal(recovering.body.preview.healthState,'UNHEALTHY');assert.equal(recovering.body.access.previewOrigin,null);
  await f.refresh();
  const before=f.accepted();
  f.sql("UPDATE project_members SET role='viewer' WHERE project_id=? AND principal_id='user_1'",f.f.p.projectId);
  assert.equal((await f.call()).body.access.canWrite,false);
  f.sql("DELETE FROM project_members WHERE project_id=? AND principal_id='user_1'",f.f.p.projectId);
  assert.equal((await f.call()).status,404);
  assert.equal((await f.call(f.path+'/access',{method:'POST',headers:{origin:f.origin,'content-type':'application/json'},body:'{}'})).status,404);
  assert.equal(f.sql('SELECT count(*) n FROM preview_tickets')[0].n,0);assert.deepEqual(f.accepted(),before);
});

test('unconfigured preview gateway stays explicit and the absent identity resolver closes every preview entry', {timeout:120000}, async t=>{
  const f=await previewEntryFixture(t,{configured:false});
  const query=await f.call();assert.equal(query.status,200);assert.equal(query.body.access.state,'NOT_CONFIGURED');assert.equal(query.body.access.previewOrigin,null);
  assert.match((await f.call(f.path+'/view')).text,/id="open" disabled/);
  assert.equal((await f.call(f.path+'/access',{method:'POST',headers:{origin:f.origin,'content-type':'application/json'},body:'{}'})).status,503);
  const app=express(),api=mountInputApi(app,f.content,{enabled:true,baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)}}),server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1${f.path}`);assert.equal(response.status,503);assert.equal((await response.json()).error.code,'IDENTITY_NOT_CONFIGURED');
  assert.equal(f.sql('SELECT count(*) n FROM preview_tickets')[0].n,0);
});

test('a real preview without an enrolled write gate remains explicitly unconfigured and cannot mint a ticket', {timeout:120000}, async t=>{
  const f=await previewEntryFixture(t,{gateConfigured:false});
  const query=await f.call();assert.equal(query.status,200);assert.equal(query.body.access.state,'NOT_CONFIGURED');assert.equal(query.body.access.previewOrigin,null);
  const issued=await f.call(f.path+'/access',{method:'POST',headers:{origin:f.origin,'content-type':'application/json'},body:'{}'});
  assert.equal(issued.status,503);assert.equal(issued.body.error.code,'PREVIEW_ACCESS_NOT_CONFIGURED');
  assert.equal(f.sql('SELECT count(*) n FROM preview_tickets')[0].n,0);
});

test('actual frozen delivery download is an inert attachment and rechecks membership before sending', {timeout:180000}, async t=>{
  const f=await releaseFreezeFixture(t),candidate=await f.freeze(),app=express();let revoke=false;
  const content={storage:f.storage,async openRead(...args){const opened=await f.content.openRead(...args);if(revoke)f.run("DELETE FROM project_members WHERE project_id=? AND principal_id='user_1'",f.p.projectId);return opened;}};
  const api=mountInputApi(app,content,{enabled:true,baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},identityResolver:previewFixtureIdentity}),server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
  const material=candidate.manifest.delivery.materials.find(m=>m.materialKey==='source')??candidate.manifest.delivery.materials[0],url=`http://127.0.0.1:${server.address().port}/api/v1/runs/${f.p.runId}/candidates/${candidate.candidateId}/materials/${material.materialKey}/download`;
  const expected=await f.content.readBytes('user_1',{kind:'releaseDelivery',operationId:candidate.manifest.delivery.record.operationId,materialKey:material.materialKey});
  const before={project:f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId),run:await f.storage.request('getRun',{runId:f.p.runId}),releases:f.get('SELECT count(*) n FROM releases')};
  const response=await fetch(url,{headers:{authorization:'Bearer fixture_preview_owner'}});assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.match(response.headers.get('content-security-policy'),/sandbox/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),Buffer.from(expected));
  assert.equal((await fetch(url,{headers:{authorization:'Bearer fixture_preview_outsider'}})).status,404);
  assert.equal((await fetch(url,{headers:{authorization:'Bearer fixture_preview_owner',range:'bytes=0-1'}})).status,416);
  revoke=true;const refused=await fetch(url,{headers:{authorization:'Bearer fixture_preview_owner'}});assert.equal(refused.status,404);assert.match(refused.headers.get('content-type'),/application\/json/);
  assert.deepEqual(f.get('SELECT accepted_release_id FROM projects WHERE project_id=?',f.p.projectId),before.project);assert.deepEqual(await f.storage.request('getRun',{runId:f.p.runId}),before.run);assert.deepEqual(f.get('SELECT count(*) n FROM releases'),before.releases);
});
