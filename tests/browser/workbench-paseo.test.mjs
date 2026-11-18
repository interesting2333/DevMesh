import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';
import {waitForWorkbenchDraft} from './workbench-draft-assertions.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const output='.cache/paseo-style/screenshots';
async function harness(t){
 const api=await inputFixture(t,{identityResolver:()=>({principalId:'user_1'})}),browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1600,height:1000},colorScheme:'light'}),errors=[];
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);});await mkdir(output,{recursive:true});
 const page=await context.newPage();return {api,page,context};
}
test('approved desktop layout keeps real projects searchable, the input dock visible and its draft intact',{timeout:60000},async t=>{
 const {api,page}=await harness(t);for(const name of ['团队任务看板','内部知识库','客户工单系统'])await api.create({name});
 let writes=0;page.on('request',r=>{if(r.method()!=='GET')writes++;});
 await page.goto(api.origin+'/api/v1/workbench/view');await expect(page.locator('#input-text')).toBeEnabled();await expect(page.getByRole('button',{name:'团队任务看板',exact:true})).toBeVisible();
 async function checkComposer(){
  const add=page.locator('.attachment-add'),send=page.getByRole('button',{name:'发起任务',exact:true}),a=await add.boundingBox(),s=await send.boundingBox();assert(a&&s&&a.x+a.width<s.x&&Math.abs(a.y-s.y)<12,'attachment and launch actions remain visible on opposite sides');
  const choosing=page.waitForEvent('filechooser');await add.click();await choosing;await page.getByRole('heading',{name:'想完成什么任务？',exact:true}).click();
 }
 await checkComposer();await page.screenshot({path:output+'/homepage-1600.png'});
 await page.locator('#input-text').fill('按确认的效果图完成工作台');await waitForWorkbenchDraft(page);
 await page.getByRole('textbox',{name:'搜索项目',exact:true}).fill('知识');await expect(page.getByRole('button',{name:'内部知识库',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'团队任务看板',exact:true})).toHaveCount(0);await expect(page.locator('#input-text')).toHaveValue('按确认的效果图完成工作台');assert.equal(writes,0);
 await page.getByRole('textbox',{name:'搜索项目',exact:true}).fill('');
 for(const [width,height]of [[1440,900],[1024,768],[390,844]]){
  await page.setViewportSize({width,height});const bounds=await page.locator('#input-text').boundingBox(),send=await page.getByRole('button',{name:'发起任务',exact:true}).boundingBox();assert(bounds.y>=0&&bounds.y+bounds.height<=height);assert(send.y>=0&&send.y+send.height<=height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);await checkComposer();await page.screenshot({path:output+'/homepage-'+width+'.png'});
 }
 await page.getByRole('navigation',{name:'工作台区域'}).getByRole('button',{name:'项目',exact:true}).click();await expect(page.getByRole('textbox',{name:'搜索项目',exact:true})).toBeVisible();await page.getByRole('button',{name:/^工作空间：/}).click();await page.getByRole('menuitem',{name:'附件管理',exact:true}).click();await expect(page.getByRole('dialog',{name:'附件管理'})).toBeVisible();await page.getByRole('button',{name:'关闭附件管理'}).click();await expect(page.locator('#input-text')).toHaveValue('按确认的效果图完成工作台');
});
test('system color preference does not change the approved theme; details and settings remain usable',{timeout:60000},async t=>{
 const {api,page}=await harness(t);await page.goto(api.origin+'/api/v1/workbench/view');await expect(page.locator('#input-text')).toBeEnabled();
 await expect(page.locator('.sidebar-empty')).toBeVisible();const empty=await page.locator('.sidebar-empty').boundingBox(),caption=await page.locator('.nav-caption').boundingBox();assert(empty.y-caption.y-caption.height<40,'empty project guidance stays next to the list heading');
 const light=await page.getByRole('main').evaluate(el=>getComputedStyle(el).backgroundColor);await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.getByRole('main').evaluate(el=>getComputedStyle(el).backgroundColor),light);
 await page.getByRole('button',{name:'执行详情',exact:true}).click();await expect(page.getByRole('complementary',{name:'执行详情'})).toBeVisible();const width=(await page.getByRole('complementary',{name:'执行详情'}).boundingBox()).width;assert.equal(width,320);await page.screenshot({path:output+'/details-1600.png'});await page.getByRole('button',{name:'收起执行详情',exact:true}).first().click();
 await page.getByRole('button',{name:'设置',exact:true}).click();await expect(page.getByRole('dialog',{name:'设置'})).toBeVisible();await page.screenshot({path:output+'/settings-1600.png'});await page.getByRole('button',{name:'关闭设置',exact:true}).click();await expect(page.locator('#input-text')).toBeEnabled();
});
