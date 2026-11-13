import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {releaseExportEntryFixture} from '../tests/fixtures/release-export-entry.mjs';
const {chromium}=createRequire(new URL('../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
test('diagnose actual export browser download',{timeout:90000},async t=>{
 const f=await releaseExportEntryFixture(t,{identityMode:'trusted-browser-fixture'}),j=await f.create();assert.equal((await f.exporter().advance('user_1',j.exportId)).state,'READY');
 f.server.prependListener('request',(req,res)=>{if(req.url.endsWith('/download')){t.diagnostic(JSON.stringify({request:req.url,hasAuth:Boolean(req.headers.authorization),origin:req.headers.origin,site:req.headers['sec-fetch-site'],host:req.headers.host}));const send=res.end;res.end=function(chunk,...args){if(res.statusCode!==200)t.diagnostic(String(chunk));return send.call(this,chunk,...args);};res.on('finish',()=>t.diagnostic(JSON.stringify({status:res.statusCode,headers:res.getHeaders()})));}});
 const browser=await chromium.launch({channel:'msedge',headless:true});t.after(()=>browser.close());const context=await browser.newContext({acceptDownloads:true,extraHTTPHeaders:f.headers}),page=await context.newPage();
 
 page.on('response',r=>{if(r.url().endsWith('/download'))t.diagnostic(JSON.stringify({status:r.status(),headers:r.headers()}));});
 page.on('requestfailed',r=>t.diagnostic(JSON.stringify({url:r.url(),failure:r.failure()})));
 await page.goto(f.page);await page.getByRole('link',{name:'下载交付包',exact:true}).waitFor();
 const waiting=page.waitForEvent('download');await page.getByRole('link',{name:'下载交付包',exact:true}).click();const d=await waiting;
 t.diagnostic(JSON.stringify({filename:d.suggestedFilename(),failure:await d.failure()}));
 assert.equal(await d.failure(),null);
});
