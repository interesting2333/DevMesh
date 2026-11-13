import test from 'node:test';import assert from 'node:assert/strict';
import {acceptanceEntryFixture} from './fixtures/acceptance-entry.mjs';

test('acceptance HTML and bundled React script share exact current-member and inert read boundaries',{timeout:240000},async t=>{
  const f=await acceptanceEntryFixture(t,{configured:false}),before=f.get('SELECT count(*) n FROM acceptance_preparations').n;
  const page=await f.httpGet(f.base+'/view');assert.equal(page.status,200);assert.match(page.headers.get('cache-control'),/no-store/);assert.equal(page.headers.get('referrer-policy'),'no-referrer');assert.equal(page.headers.get('x-content-type-options'),'nosniff');
  const html=await page.text(),policy=page.headers.get('content-security-policy'),nonce=html.match(/<style nonce="([^"]+)"/)[1];assert(policy.includes("script-src 'nonce-"+nonce+"'"));assert(policy.includes("frame-src 'none'"));assert(policy.includes("form-action 'none'"));assert.match(html,/<html lang="zh-CN">/);assert(html.includes(f.base+'/client.js'));
  const boot=JSON.parse(html.match(/<script id="acceptance-data"[^>]*>([\s\S]*?)<\/script>/)[1]);assert.equal(boot.candidateId,f.candidate.candidateId);assert.equal(boot.configured,false);assert.equal(boot.canPrepare,false);assert.equal(boot.dataPlan.strategy,'INITIAL');
  const js=await f.httpGet(f.base+'/client.js');assert.equal(js.status,200);assert.match(js.headers.get('content-type'),/application\/javascript/);assert.match(await js.text(),/Third-party notices/);
  for(const suffix of ['/view','/client.js']){assert.equal((await fetch(f.origin+f.base+suffix)).status,401);assert.equal((await f.httpGet(f.base+suffix+'?extra=1')).status,422);assert.equal((await f.httpGet(f.base.replace(f.candidate.candidateId,'candidate_unknown')+suffix)).status,404);}
  assert.equal(f.get('SELECT count(*) n FROM acceptance_preparations').n,before);assert.equal(f.get('SELECT count(*) n FROM releases').n,0);assert.equal(f.fault.reads,0);
  f.run('DELETE FROM project_members WHERE project_id=? AND principal_id=?',f.p.projectId,'user_1');for(const suffix of ['/view','/client.js'])assert.equal((await f.httpGet(f.base+suffix)).status,404);
});
