import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';
import {waitForWorkbenchDraft} from './workbench-draft-assertions.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');

test('starter examples only edit an empty local draft, retain selected files and remain usable on a narrow page',{timeout:60000},async t=>{
 const api=await inputFixture(t,{identityResolver:()=>({principalId:'user_1'})}),browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[],writes=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);});
 const dir='.cache/task-starters/screenshots';await mkdir(dir,{recursive:true});await page.goto(api.origin+'/api/v1/workbench/view');
 const text=page.locator('#input-text'),business=page.getByRole('button',{name:'使用示例：搭建业务系统',exact:true}),dashboard=page.getByRole('button',{name:'使用示例：制作数据看板',exact:true});
 await expect(business).toBeEnabled();await page.screenshot({path:dir+'/homepage-1600.png'});
 await business.click();assert.match(await text.inputValue(),/内部工单系统/);await expect(text).toBeFocused();await waitForWorkbenchDraft(page);assert.deepEqual(writes,[]);
 const original=await text.inputValue();await expect(business).toBeDisabled();await page.reload();await expect(text).toHaveValue(original);await expect(dashboard).toBeDisabled();
 await text.fill('保留我自己写的目标');await waitForWorkbenchDraft(page);await expect(business).toBeDisabled();await expect(text).toHaveValue('保留我自己写的目标');
 await page.getByLabel('添加一个附件',{exact:true}).setInputFiles({name:'需求.md',mimeType:'text/markdown',buffer:Buffer.from('# 需求\n保留此附件。')});await expect(page.getByRole('article',{name:'已选附件：需求.md'})).toBeVisible();
 await text.fill('');await expect(dashboard).toBeEnabled();await dashboard.focus();await dashboard.press('Enter');assert.match(await text.inputValue(),/运营数据看板/);await waitForWorkbenchDraft(page);await expect(page.getByRole('article',{name:'已选附件：需求.md'})).toBeVisible();assert.deepEqual(writes,[]);
 await page.reload();await expect(text).toHaveValue(/运营数据看板/);await expect(page.getByRole('article',{name:'已选附件：需求.md'})).toBeVisible();
 await page.getByRole('button',{name:'从本次输入移除',exact:true}).click();await text.fill('');await expect(business).toBeEnabled();
 for(const [width,height]of [[1440,900],[1024,768],[390,844]]){
  await page.setViewportSize({width,height});await page.getByRole('heading',{name:'想完成什么任务？',exact:true}).click();await expect(page.getByRole('button',{name:'使用示例：创建展示网站',exact:true})).toBeVisible();
  const send=await page.getByRole('button',{name:'发起任务',exact:true}).boundingBox();assert(send.y>=0&&send.y+send.height<=height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);await page.screenshot({path:dir+'/homepage-'+width+'.png'});
 }
 await page.getByRole('button',{name:'使用示例：创建展示网站',exact:true}).click();await expect(text).toBeFocused();assert.match(await text.inputValue(),/产品展示网站/);await waitForWorkbenchDraft(page);assert.deepEqual(writes,[]);
});
