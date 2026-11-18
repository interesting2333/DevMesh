import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,readFileSync,rmSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {inputFixture} from '../fixtures/input-data.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const options={timeout:120000};

async function harness(t,respond){
  const directory=mkdtempSync(join(tmpdir(),'devmesh-model-choice-'));
  t.after(()=>rmSync(directory,{recursive:true,force:true}));
  const requests=[],provider=createServer((request,response)=>{requests.push({url:request.url,key:request.headers.authorization});respond(request,response);});
  provider.listen(0,'127.0.0.1');await once(provider,'listening');
  t.after(()=>new Promise(resolve=>provider.close(resolve)));
  const f=await inputFixture(t,{settingsRoot:directory,identityResolver:()=>({principalId:'user_1'})}),browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);});
  await page.goto(f.origin+'/api/v1/workbench/view');
  const open=async()=>{await page.getByRole('button',{name:'设置',exact:true}).click();const dialog=page.getByRole('dialog',{name:'设置',exact:true});await expect(dialog.getByLabel('Provider',{exact:true})).toBeEnabled();return dialog;};
  return {f,page,open,directory,requests,endpoint:`http://127.0.0.1:${provider.address().port}/v1`};
}
const model=dialog=>dialog.getByRole('combobox',{name:'模型',exact:true});
const modelStatus=dialog=>dialog.getByRole('status',{name:'模型列表状态'});
async function connect(dialog,endpoint){await dialog.getByLabel('Provider',{exact:true}).fill('test-proxy');await dialog.getByLabel('Endpoint',{exact:true}).fill(endpoint);await dialog.getByLabel('API Key',{exact:true}).fill('sk-local-browser-fixture');}

test('settings discovers unsaved provider models, persists only explicit choice, and reloads the list with the saved key',options,async t=>{
  const h=await harness(t,(_request,response)=>{response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'vendor-chat-pro'},{id:'vendor-reasoner'},{id:'vendor-chat-pro'}]}));});
  const dialog=await h.open();await connect(dialog,h.endpoint);await dialog.getByRole('button',{name:'获取模型列表',exact:true}).click();
  await expect(modelStatus(dialog)).toHaveText('已获取 2 个模型。');
  await model(dialog).selectOption('vendor-reasoner');
  assert.equal((await h.f.call('/settings/model')).body.configured,false);
  await dialog.getByRole('button',{name:'保存设置',exact:true}).click();await expect(dialog.getByRole('status',{name:'设置操作状态'})).toContainText('重启服务后生效');
  assert.equal((await h.f.call('/settings/model')).body.model,'vendor-reasoner');
  await expect(dialog.getByLabel('API Key',{exact:true})).toHaveValue('');
  assert.equal((await dialog.innerText()).includes('sk-local-browser-fixture'),false);
  assert.equal(readFileSync(join(h.directory,'model-secret.json'),'utf8').includes('sk-local-browser-fixture'),true);
  await dialog.getByRole('button',{name:'关闭设置',exact:true}).click();
  const reopened=await h.open();await expect(modelStatus(reopened)).toHaveText('已获取 2 个模型。');await expect(model(reopened)).toHaveValue('vendor-reasoner');
  assert.equal(h.requests.length,2);assert(h.requests.every(request=>request.url==='/v1/models'&&request.key==='Bearer sk-local-browser-fixture'));
  const output='project/evidence/P0-06/development/model-selection';mkdirSync(output,{recursive:true});
  await h.page.screenshot({path:output+'/settings-1440.png',fullPage:true});
  await h.page.setViewportSize({width:390,height:844});await expect(model(reopened)).toBeVisible();
  assert.equal(await h.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const bounds=await reopened.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390);
  await h.page.screenshot({path:output+'/settings-390.png',fullPage:true});
});

test('unavailable model discovery retains the model and permits manual selection and saving',options,async t=>{
  const h=await harness(t,(_request,response)=>{response.writeHead(404,{'content-type':'application/json'});response.end(JSON.stringify({error:'sk-local-browser-fixture upstream diagnostic'}));});
  const dialog=await h.open();await connect(dialog,h.endpoint);await dialog.getByRole('button',{name:'获取模型列表',exact:true}).click();
  await expect(modelStatus(dialog)).toContainText('HTTP 404');
  await expect(dialog.getByLabel('自定义模型 ID',{exact:true})).toHaveValue('deepseek-chat');
  await dialog.getByLabel('自定义模型 ID',{exact:true}).fill('vendor-custom-v1');await dialog.getByRole('button',{name:'保存设置',exact:true}).click();
  await expect(dialog.getByRole('status',{name:'设置操作状态'})).toContainText('已保存');
  assert.equal((await h.f.call('/settings/model')).body.model,'vendor-custom-v1');
  assert.equal((await dialog.innerText()).includes('upstream diagnostic'),false);
});

test('changing a connection or closing the dialog discards delayed discovery results',options,async t=>{
  let pending=Promise.withResolvers(),release=Promise.withResolvers(),done=Promise.withResolvers();t.after(()=>release.resolve());
  const h=await harness(t,async(_request,response)=>{const completed=done;pending.resolve();await release.promise;response.setHeader('content-type','application/json');response.end(JSON.stringify({data:[{id:'obsolete-model'}]}));completed.resolve();});
  const dialog=await h.open();await connect(dialog,h.endpoint);await dialog.getByRole('button',{name:'获取模型列表',exact:true}).click();await pending.promise;
  await dialog.getByLabel('Endpoint',{exact:true}).fill(h.endpoint+'/other');release.resolve();await done.promise;
  await expect(modelStatus(dialog)).toContainText('接入信息已变化');await expect(model(dialog).locator('option',{hasText:'obsolete-model'})).toHaveCount(0);
  pending=Promise.withResolvers();release=Promise.withResolvers();done=Promise.withResolvers();
  await dialog.getByRole('button',{name:'获取模型列表',exact:true}).click();await pending.promise;
  await dialog.getByRole('button',{name:'关闭设置',exact:true}).click();const reopened=await h.open();release.resolve();await done.promise;
  await expect(model(reopened)).toHaveValue('deepseek-chat');await expect(modelStatus(reopened)).toContainText('获取此接入');
  await expect(model(reopened).locator('option',{hasText:'obsolete-model'})).toHaveCount(0);
});
