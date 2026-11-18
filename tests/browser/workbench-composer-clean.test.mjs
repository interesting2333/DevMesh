import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';
import {waitForWorkbenchDraft} from './workbench-draft-assertions.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const screenshots='.cache/clean-composer/screenshots';
async function harness(t){
 let principal='user_1';const api=await inputFixture(t,{identityResolver:()=>({principalId:principal})}),browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);});await mkdir(screenshots,{recursive:true});
 async function open(query=''){const p=await context.newPage();await p.goto(api.origin+'/api/v1/workbench/view'+query);await expect(p.locator('#input-text').or(p.getByRole('heading',{level:1})).first()).toBeVisible();return p;}
 return {api,context,open,principal:p=>{principal=p;}};
}
test('default composer is uncluttered while attachment help, management and durable silent drafts remain available',{timeout:60000},async t=>{
 const h=await harness(t),p=await h.open();await expect(p.locator('#input-text')).toBeEnabled();
 for(const text of ['项目名称（可选）','上传记录与恢复','草稿已保存在本机','也可拖拽 · TXT / Markdown · 每个 ≤ 2 MiB · 最多 3 个'])await expect(p.getByText(text,{exact:true})).toHaveCount(0);
 await expect(p.locator('.attachment-add')).toHaveAttribute('title',/2 MiB.*3/);
 await p.screenshot({path:screenshots+'/homepage-1440.png'});await p.locator('#input-text').fill('静默保存仍可恢复');await waitForWorkbenchDraft(p);await p.reload();await expect(p.locator('#input-text')).toHaveValue('静默保存仍可恢复');
 await p.getByRole('button',{name:/^工作空间：/}).click();await p.getByRole('menuitem',{name:'附件管理',exact:true}).click();await expect(p.getByRole('dialog',{name:'附件管理'})).toBeVisible();await p.getByRole('dialog',{name:'附件管理'}).getByRole('button',{name:'关闭附件管理'}).click();await expect(p.getByRole('dialog')).toHaveCount(0);
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:screenshots+'/homepage-390.png'});
 await p.getByRole('navigation',{name:'工作台区域'}).getByRole('button',{name:'项目',exact:true}).click();await p.getByRole('button',{name:/^工作空间：/}).click();await p.getByRole('menuitem',{name:'附件管理',exact:true}).click();await expect(p.getByRole('dialog',{name:'附件管理'})).toBeVisible();await p.getByRole('button',{name:'关闭附件管理',exact:true}).click();await expect(p.locator('#input-text')).toHaveValue('静默保存仍可恢复');
});
test('automatic project name can be renamed after launch; lost acknowledgement retries the same title operation and retains the task draft',{timeout:90000},async t=>{
 const h=await harness(t),p=await h.open();await p.locator('#input-text').fill('默认项目需求');await p.getByRole('button',{name:'发起任务',exact:true}).click();await expect(p).toHaveURL(/projectId=/);
 await expect(p.getByRole('main').getByRole('heading',{name:'默认项目需求',exact:true})).toBeVisible();await p.locator('#input-text').fill('重命名期间保留的补充草稿');await waitForWorkbenchDraft(p);
 const requests=[];p.on('request',r=>{if(r.method()==='PUT')requests.push({key:r.headers()['idempotency-key'],body:r.postDataJSON()});});
 await p.route('**/api/v1/projects/*/name',async route=>{assert.equal((await route.fetch()).status(),200);await route.abort('failed');},{times:1});
 await p.getByRole('button',{name:'重命名项目',exact:true}).click();let dialog=p.getByRole('dialog',{name:'重命名项目',exact:true});await dialog.getByLabel('项目名称',{exact:true}).fill('团队协作项目');await dialog.getByRole('button',{name:'保存名称',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('尚未确认');
 await p.reload();await expect(p.locator('#input-text')).toHaveValue('重命名期间保留的补充草稿');assert.equal(requests.length,1);
 await p.getByRole('button',{name:'重命名项目',exact:true}).click();dialog=p.getByRole('dialog',{name:'重命名项目',exact:true});await expect(dialog.getByLabel('项目名称',{exact:true})).toBeDisabled();await dialog.getByRole('button',{name:'使用原请求重试',exact:true}).click();await expect(dialog).toHaveCount(0);
 assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);assert.equal(h.api.sql("SELECT count(*) n FROM operations WHERE kind='RenameInputProject'")[0].n,1);
 await expect(p.getByRole('main').getByRole('heading',{name:'团队协作项目',exact:true})).toBeVisible();await expect(p.locator('#input-text')).toHaveValue('重命名期间保留的补充草稿');await p.screenshot({path:screenshots+'/renamed-project-1440.png'});
});
test('invalid attachments and local save failures remain visible instead of silently discarding input',{timeout:60000},async t=>{
 const h=await harness(t),p=await h.open();await expect(p.locator('#input-text')).toBeEnabled();await p.getByLabel('添加一个附件',{exact:true}).setInputFiles({name:'无效.png',mimeType:'image/png',buffer:Buffer.from('not supported')});await expect(p.getByRole('region',{name:'尚未保存的文件'})).toBeVisible();await expect(p.getByRole('region',{name:'输入附件'}).getByRole('alert')).toBeVisible();await expect(p.getByRole('button',{name:'发起任务',exact:true})).toBeDisabled();
});
