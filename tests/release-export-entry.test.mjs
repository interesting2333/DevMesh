import test from 'node:test';import assert from 'node:assert/strict';
import {releaseExportEntryFixture} from './fixtures/release-export-entry.mjs';
import {canonical} from './fixtures/storage-data.mjs';
const facts=f=>canonical(Object.fromEntries(['releases','acceptance_commits','release_promotion_outbox','release_publications','projects','runs'].map(table=>[table,f.db.prepare('SELECT * FROM '+table).all()])));
test('React export page and protected local asset remain read-only, scoped and nonce protected',{timeout:120000},async t=>{
  const f=await releaseExportEntryFixture(t),before=facts(f),response=await fetch(f.page,{headers:f.headers}),html=await response.text();assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  const csp=response.headers.get('content-security-policy'),nonce=csp.match(/script-src 'nonce-([^']+)'/)[1];assert(!csp.includes('unsafe-inline'));assert(csp.includes("connect-src 'self'"));assert(csp.includes("frame-src 'none'"));assert(html.includes('nonce="'+nonce+'"'));assert(!html.includes('claimToken'));assert(!html.includes('gitDirectory'));
  const initial=JSON.parse(html.match(/id="export-data"[^>]*>([^<]*)<\/script>/)[1]);assert.equal(initial.entry.codeCommit,f.sourceManifest.commit);assert.equal(initial.entry.releaseId,f.publication.releaseId);assert.deepEqual(initial.list,{jobs:[],nextCursor:null});
  const asset=await fetch(f.origin+f.base+'/client.js',{headers:f.headers});assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/javascript/);const js=await asset.text();assert(js.length>50000);assert(!/from\s*["']react/.test(js));
  const release=await fetch(f.origin+'/api/v1/runs/'+f.p.runId+'/releases/'+f.publication.releaseId+'/view',{headers:f.headers});assert((await release.text()).includes(f.base+'/view'));assert.equal(f.get('SELECT count(*) n FROM release_exports').n,0);assert.equal(facts(f),before);
  assert.equal((await fetch(f.page)).status,401);assert.equal((await fetch(f.origin+f.base+'/client.js')).status,401);assert.equal((await fetch(f.page+'?unexpected=1',{headers:f.headers})).status,422);
});
test('retry affordance comes from original creator, current membership and actual state; page escapes unsafe error text',{timeout:120000},async t=>{
  const f=await releaseExportEntryFixture(t),j=await f.create(),subject={principalId:'user_1',exportId:j.exportId},claim=await f.call('claimReleaseExport',subject);assert.equal(claim.job.canRetry,false);
  f.run('UPDATE release_exports SET lease_until=? WHERE export_id=?','2000-01-01T00:00:00.000Z',j.exportId);assert.equal((await f.call('getReleaseExport',subject)).canRetry,true);
  f.run('INSERT INTO project_members(project_id,principal_id,role,created_at) VALUES(?,?,?,?)',f.p.projectId,'export.viewer','viewer',new Date().toISOString());assert.equal((await f.call('getReleaseExport',{...subject,principalId:'export.viewer'})).canRetry,false);
  const other=await fetch(f.origin+'/api/v1/exports/'+j.exportId+'/retry',{method:'POST',headers:{authorization:'Bearer fixture_export_viewer','content-type':'application/json'},body:JSON.stringify({expectedGeneration:1})});assert.equal(other.status,403);
  f.run("UPDATE release_exports SET state='FAILED',error_code=? WHERE export_id=?",'</script><img src=x onerror="globalThis.exportXss=true">',j.exportId);
  const html=await (await fetch(f.page,{headers:f.headers})).text();assert(!html.includes('<img'));assert(html.includes('\\u003c/script\\u003e'));
  f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');assert.equal((await fetch(f.page,{headers:f.headers})).status,404);assert.equal((await fetch(f.origin+f.base+'/client.js',{headers:f.headers})).status,404);
});
