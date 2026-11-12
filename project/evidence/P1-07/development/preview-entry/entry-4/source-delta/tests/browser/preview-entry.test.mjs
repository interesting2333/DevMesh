// Actual browser enters through production platform routes and generated assets.
// Bearer identity and candidate/container facts are explicit local fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {previewEntryFixture} from '../fixtures/preview-entry.mjs';
const {chromium}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
test('actual Edge opens the platform preview entry, exchanges its session and edits the real template through the isolated iframe', {timeout:120000}, async t=>{
  const f=await previewEntryFixture(t,{webRoot:resolve('templates/web-crud-v1/dist/web')}),before=f.accepted();
  const browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true,args:['--no-proxy-server','--host-resolver-rules=MAP *.apps.devmesh-app.test 127.0.0.1,EXCLUDE localhost']});
  t.after(()=>browser.close());
  const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage(),errors=[];
  // The test's trusted platform identity adapter is scoped to the platform host;
  // no platform Authorization header is installed on preview requests.
  await context.route(f.origin+'/**',route=>route.continue({headers:{...route.request().headers(),authorization:'Bearer fixture_preview_owner'}}));
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(f.origin+'/api/v1'+f.path+'/view',{waitUntil:'domcontentloaded'});
  assert.equal(f.sql('SELECT count(*) n FROM preview_tickets')[0].n,0);
  await f.refresh();
  const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame.url().startsWith('https://p-'),timeout:20000});
  await page.getByRole('button',{name:'打开预览',exact:true}).click();
  const frame=await navigation;await frame.waitForLoadState('domcontentloaded');
  await frame.getByRole('heading',{name:'把想法，变成进展。'}).waitFor();
  await frame.getByRole('button',{name:'＋ 新建任务',exact:true}).click();
  await frame.getByLabel('标题',{exact:true}).fill('Platform entry browser write');
  await frame.getByRole('button',{name:'保存任务',exact:true}).click();
  await frame.getByRole('heading',{name:'Platform entry browser write',exact:true}).waitFor();
  assert.equal((await f.appStore.list()).tasks.length,1);
  assert.equal((await f.rows()).filter(row=>row.request_json.includes('"method":"POST"')).length,1);
  assert.equal((await context.cookies(f.origin)).some(cookie=>cookie.name==='__Host-devmesh-preview'),false);
  const own=(await context.cookies(frame.url())).find(cookie=>cookie.name==='__Host-devmesh-preview');assert.ok(own?.httpOnly&&own.secure);assert.equal(own.sameSite,'None');
  assert.equal(await frame.evaluate(()=>{try{void parent.document.body;return false;}catch{return true;}}),true);
  assert.deepEqual(f.accepted(),before);assert.deepEqual(errors,[]);
  t.diagnostic(JSON.stringify({browser:browser.version(),platformOrigin:f.origin,previewOrigin:new URL(frame.url()).origin,actualTemplateUi:true,actualBusinessRows:1,scope:'Actual local entry/query/issuance/CORS/session probe/iframe/React assets/HTTP/SQLite; explicit identity and container facts, browser test TLS errors ignored, no OIDC or OCI acceptance'}));
});
