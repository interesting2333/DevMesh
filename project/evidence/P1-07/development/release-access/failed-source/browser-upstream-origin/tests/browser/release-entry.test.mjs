// Actual Edge and generated React assets; trusted local identity/physical fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {releaseEntryFixture} from '../fixtures/release-entry.mjs';
const {chromium}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
test('actual Edge opens the accepted Release page, exchanges its own session and writes through the isolated React iframe',{timeout:180000},async t=>{
 const f=await releaseEntryFixture(t,{webRoot:resolve('templates/web-crud-v1/dist/web')}),before=f.accepted(),mutations=f.mutations(),browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true,args:['--no-proxy-server','--host-resolver-rules=MAP *.apps.devmesh-app.test 127.0.0.1,EXCLUDE localhost']});t.after(()=>browser.close());
 const context=await browser.newContext({ignoreHTTPSErrors:true}),page=await context.newPage(),errors=[];await context.route(f.origin+'/**',route=>route.continue({headers:{...route.request().headers(),authorization:'Bearer fixture_release_owner'}}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(f.origin+'/api/v1'+f.path+'/view',{waitUntil:'domcontentloaded'});assert.equal(f.control.get('SELECT count(*) n FROM release_tickets').n,0);
 const navigation=page.waitForEvent('framenavigated',{predicate:frame=>frame.url().startsWith('https://r-'),timeout:20000});await page.getByRole('button',{name:'打开应用',exact:true}).click();const frame=await navigation;await frame.waitForLoadState('domcontentloaded');await frame.getByRole('heading',{name:'把想法，变成进展。'}).waitFor();
 await frame.getByRole('button',{name:'＋ 新建任务',exact:true}).click();await frame.getByLabel('标题',{exact:true}).fill('Release browser write');await frame.getByRole('button',{name:'保存任务',exact:true}).click();await frame.getByRole('heading',{name:'Release browser write',exact:true}).waitFor();
 assert.equal((await fetch(f.origin+'/api/tasks').then(r=>r.json())).tasks.filter(r=>r.title==='Release browser write').length,1);assert.equal(f.rows().filter(r=>JSON.parse(r.request_json).request.method==='POST').length,1);
 assert.equal((await context.cookies(f.origin)).some(c=>c.name==='__Host-devmesh-release'),false);const own=(await context.cookies(frame.url())).find(c=>c.name==='__Host-devmesh-release');assert.ok(own?.httpOnly&&own.secure);assert.equal(own.sameSite,'None');assert.equal(await frame.evaluate(()=>{try{void parent.document.body;return false;}catch{return true;}}),true);assert.deepEqual(f.accepted(),before);assert.deepEqual(f.mutations(),mutations);assert.deepEqual(errors,[]);
 t.diagnostic(JSON.stringify({browser:browser.version(),actualTemplateUi:true,actualBusinessRows:1,purpose:'RELEASE',scope:'Actual local platform/TLS/session/iframe/React/HTTP/SQLite; explicit identity/fence/guard/OCI/route fixtures; browser ignores test TLS errors; no OIDC or physical acceptance'}));
});
