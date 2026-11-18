import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';

const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const screenshots='.cache/task-first/screenshots';
async function harness(t){
 const api=await inputFixture(t,{identityResolver:()=>({principalId:'user_1'})});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:900}}),errors=[];
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);});
 async function open(query='',target=context){const page=await target.newPage();await page.goto(api.origin+'/api/v1/workbench/view'+query);await expect(page.locator('#input-text')).toBeEnabled();return page;}
 await mkdir(screenshots,{recursive:true});
 t.diagnostic('Actual protected React page, Edge, IndexedDB and local HTTP/SQLite fixture; no external model or product acceptance.');
 return {api,browser,context,open};
}
const payload={name:'需求材料.md',mimeType:'text/markdown',buffer:Buffer.from('# 任务目标\n制作一个团队看板。')};
const selected=p=>p.getByRole('article',{name:'已选附件：'+payload.name,exact:true});
async function noOverflow(page){const size=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&r.right>innerWidth;}).slice(0,5).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right}))}));assert(size.scrollWidth<=size.width&&size.scrollHeight<=size.height,JSON.stringify(size));}

test('task entry keeps input dock visible; details expand, collapse and use a narrow overlay without losing a draft',{timeout:90000},async t=>{
 const h=await harness(t),p=await h.open();
 await expect(p.getByRole('complementary',{name:'执行详情'})).toBeHidden();
 await p.screenshot({path:screenshots+'/homepage-1440.png'});
 const full=await p.getByRole('main').boundingBox();
 await p.locator('#input-text').fill('保留这份需求草稿');
 await p.getByRole('button',{name:'执行详情',exact:true}).click();
 await expect(p.getByRole('complementary',{name:'执行详情'})).toBeVisible();
 const smaller=await p.getByRole('main').boundingBox(),right=await p.getByRole('complementary',{name:'执行详情'}).boundingBox();
 assert.equal(Math.round(right.width),320);assert(full.width-smaller.width>=320);
 await p.screenshot({path:screenshots+'/details-1440.png'});
 await p.getByRole('button',{name:'收起执行详情',exact:true}).first().click();
 await expect(p.getByRole('complementary',{name:'执行详情'})).toBeHidden();
 await expect(p.locator('#input-text')).toHaveValue('保留这份需求草稿');
 for(const width of [1366,1024,390]){
  await p.setViewportSize({width,height:width===390?844:768});
  await p.screenshot({path:screenshots+'/before-check-'+width+'.png'});
  await noOverflow(p);
  const dock=await p.locator('.composer-dock').boundingBox(),input=await p.locator('#input-text').boundingBox();
  assert(dock.y+dock.height<=(width===390?844:768));assert(input.y>=0&&input.y+input.height<=(width===390?844:768));
  const before=await p.getByRole('main').boundingBox();
  await p.getByRole('button',{name:'执行详情',exact:true}).click();
  if(width<1200)assert.equal((await p.getByRole('main').boundingBox()).width,before.width);
  await p.keyboard.press('Escape');
  await expect(p.locator('#input-text')).toHaveValue('保留这份需求草稿');
  await p.screenshot({path:screenshots+'/homepage-'+width+'.png'});
 }
});

test('one explicit launch accepts text, attachment alone and combined input; selecting or refreshing never uploads',{timeout:120000},async t=>{
 const h=await harness(t);
 for(const [index,mode] of ['text','file','combined'].entries()){
  const context=await h.browser.newContext(),p=await h.open('',context),posts=[];
  p.on('request',r=>{if(r.method()==='POST')posts.push(new URL(r.url()).pathname);});
  if(mode!=='file')await p.locator('#input-text').fill('创建团队看板 '+mode);
  if(mode!=='text'){
   await p.getByLabel('添加一个附件',{exact:true}).setInputFiles(payload);
   await expect(selected(p)).toBeVisible();
   assert.equal(posts.length,0);
   await p.reload();await expect(selected(p)).toBeVisible();assert.equal(posts.length,0);
  }
  await p.getByRole('button',{name:'发起任务',exact:true}).click();
  await expect(p).toHaveURL(/projectId=/,{timeout:30000});
  assert.equal(h.api.sql('SELECT count(*) n FROM projects')[0].n,index+1);
  const {body:workspace}=await h.api.call('/projects/'+new URL(p.url()).searchParams.get('projectId')+'/workspace');
  assert.equal(workspace.messages[0].text,mode==='file'?'':'创建团队看板 '+mode);
  assert.equal(workspace.messages[0].attachmentIds.length,mode==='text'?0:1);
  assert.equal(posts.filter(path=>path==='/api/v1/attachments').length,mode==='text'?0:1);
  assert.equal(posts.filter(path=>path==='/api/v1/projects').length,1);
  await expect(p.getByRole('region',{name:'任务分析与计划'})).toBeVisible();
  await expect(p.getByRole('complementary',{name:'执行详情'})).toBeHidden();
  await context.close();
 }
});

test('lost upload acknowledgement keeps original bytes; explicit retry looks up the same upload and creates one task',{timeout:90000},async t=>{
 const h=await harness(t),p=await h.open();let uploads=0,projects=0;
 p.on('request',r=>{if(r.method()==='POST'){const path=new URL(r.url()).pathname;if(path==='/api/v1/attachments')uploads++;if(path==='/api/v1/projects')projects++;}});
 await p.locator('#input-text').fill('上传失败后保留需求');
 await p.getByLabel('添加一个附件',{exact:true}).setInputFiles(payload);await expect(selected(p)).toBeVisible();
 await p.route('**/api/v1/attachments',async route=>{assert.equal((await route.fetch()).status(),201);await route.abort('failed');},{times:1});
 await p.getByRole('button',{name:'发起任务',exact:true}).click();
 await expect(p.getByRole('region',{name:'输入附件'}).getByRole('alert')).toBeVisible();
 assert.equal(uploads,1);assert.equal(projects,0);
 await p.reload();await expect(selected(p)).toBeVisible();
 await expect(p.locator('#input-text')).toHaveValue('上传失败后保留需求');assert.equal(uploads,1);
 await p.getByRole('button',{name:'发起任务',exact:true}).click();await expect(p).toHaveURL(/projectId=/,{timeout:30000});
 assert.equal(uploads,1);assert.equal(projects,1);assert.equal(h.api.sql('SELECT count(*) n FROM attachments')[0].n,1);
});

test('long task output scrolls independently; planning stays in main and detail preferences survive refresh',{timeout:90000},async t=>{
 const h=await harness(t),created=await h.api.create({name:'长输出验证',initialRequest:{text:'需求材料的一行详细说明。\n'.repeat(300),attachmentIds:[]}}),result=created.body.result;
 const p=await h.open('?projectId='+result.projectId+'&runId='+result.runId);
 await expect(p.getByRole('region',{name:'任务分析与计划'})).toBeAttached();
 await p.locator('#input-text').fill('底部补充说明始终可编辑');
 const before=await p.locator('#input-text').boundingBox();
 await p.getByRole('region',{name:'任务输出'}).evaluate(el=>{el.scrollTop=0;});
 assert.deepEqual(await p.locator('#input-text').boundingBox(),before);
 await p.getByRole('button',{name:'执行详情',exact:true}).click();
 await p.reload();await expect(p.getByRole('complementary',{name:'执行详情'})).toBeVisible();
 await expect(p.locator('#input-text')).toHaveValue('底部补充说明始终可编辑');
 await p.getByRole('button',{name:'在主区域查看理解与计划',exact:true}).click();
 await expect(p.getByRole('region',{name:'任务分析与计划'})).toBeVisible();
 await noOverflow(p);await p.screenshot({path:screenshots+'/task-output-1440.png'});
});

test('dragging files only saves local selection; three compact attachments and dark mobile layout remain usable',{timeout:60000},async t=>{
 const h=await harness(t),p=await h.open(),posts=[];p.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 await p.locator('.composer').evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['拖入的需求原文'],'拖拽需求.md',{type:'text/markdown'}));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});
 await expect(p.getByRole('article',{name:'已选附件：拖拽需求.md'})).toBeVisible();
 for(const name of ['补充一.md','补充二.md'])await p.getByLabel('添加一个附件',{exact:true}).setInputFiles({...payload,name});
 await expect(p.locator('.attachment-chip')).toHaveCount(3);await expect(p.getByLabel('添加一个附件',{exact:true})).toBeDisabled();
 assert.equal(posts.length,0);await p.reload();await expect(p.locator('.attachment-chip')).toHaveCount(3);assert.equal(posts.length,0);
 await p.setViewportSize({width:390,height:844});await p.emulateMedia({colorScheme:'dark'});await noOverflow(p);
 const send=await p.getByRole('button',{name:'发起任务',exact:true}).boundingBox(),input=await p.locator('#input-text').boundingBox();assert(send.y>=0&&send.y+send.height<=844);assert(input.y>=0&&input.y+input.height<=844);
 await p.screenshot({path:screenshots+'/attachments-dark-390.png'});
 await p.getByRole('button',{name:'发起任务',exact:true}).click();await expect(p).toHaveURL(/projectId=/,{timeout:30000});
 assert.equal(posts.filter(url=>new URL(url).pathname==='/api/v1/attachments').length,3);
 assert.equal(h.api.sql('SELECT count(*) n FROM attachments')[0].n,3);
});
