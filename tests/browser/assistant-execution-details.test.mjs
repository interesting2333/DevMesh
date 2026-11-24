import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {generatedFixture,html} from '../fixtures/generated-conversation.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
async function browser(t,f){const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:1440,height:1000},acceptDownloads:true,extraHTTPHeaders:{authorization:'Bearer test_owner'}});t.after(()=>b.close());const posts=[];p.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});await p.goto(f.origin+'/api/v1/workbench/view?conversationId='+f.id);await p.getByRole('button',{name:'执行详情',exact:true}).click();return {p,posts,panel:p.getByRole('complementary',{name:'执行详情'}).getByRole('tabpanel')};}

test('all five assistant tabs show durable facts, preview and download without re-execution or losing the draft',{timeout:120000},async t=>{
 const f=await generatedFixture(t);await f.input();await f.runTurn();const before=f.sql('SELECT (SELECT count(*) FROM assistant_steps) steps,(SELECT count(*) FROM assistant_tool_calls) tools,(SELECT count(*) FROM operations) operations');
 const {p,posts,panel}=await browser(t,f);await p.locator('#conversation-input').fill('浏览详情时保留的草稿');
 await expect(panel).toContainText('创建一个英语学习网站html');await expect(panel).toContainText('本轮已完成');await expect(panel).toContainText('独立任务目录');
 await expect(p.getByRole('button',{name:'历史结果',exact:true})).toHaveCount(0);
 await p.getByRole('tab',{name:'协作',exact:true}).click();await expect(panel).toContainText('本轮由主助手独立执行');await expect(panel).toContainText('保存文件');await expect(panel).toContainText('运行检查');
 await p.getByRole('tab',{name:'成果',exact:true}).click();await expect(panel.getByRole('region',{name:'助手生成成果'})).toContainText('index.html');await expect(panel.getByRole('region',{name:'执行检查'})).toContainText('HTML 基础检查 · 成功');
 await p.getByRole('tab',{name:'预览',exact:true}).click();await panel.getByRole('button',{name:'预览页面',exact:true}).click();const frame=p.frameLocator('iframe[title="生成的 HTML 页面"]');await expect(frame.getByRole('heading',{name:'英语学习网站'})).toBeVisible();await expect.poll(()=>frame.locator('body').evaluate(()=>document.readyState)).toBe('complete');await expect.poll(()=>frame.getByRole('button',{name:'开始练习'}).evaluate(el=>typeof el.onclick)).toBe('function');await frame.getByRole('button',{name:'开始练习'}).click();await expect(frame.locator('#result')).toHaveText('apple 的意思是苹果');assert.equal(await frame.locator('body').evaluate(()=>{try{return parent.document.title;}catch(e){return e.name;}}),'SecurityError');await p.getByRole('button',{name:'关闭预览',exact:true}).click();
 await p.getByRole('tab',{name:'成果',exact:true}).click();const downloading=p.waitForEvent('download');await panel.getByRole('button',{name:'下载文件',exact:true}).click();const download=await downloading;assert.equal(download.suggestedFilename(),'index.html');assert.equal(await readFile(await download.path(),'utf8'),html);
 await p.getByRole('tab',{name:'记录',exact:true}).click();await expect(panel).toContainText('共 6 项实际执行记录');await expect(panel).toContainText('保存文件 · 成功');await expect(panel).toContainText('HTML 基础检查 · 退出码 0');
 await p.reload();await p.getByRole('button',{name:'执行详情',exact:true}).click();await expect(p.getByRole('tab',{name:'记录',exact:true})).toHaveAttribute('aria-selected','true');await expect(p.locator('#conversation-input')).toHaveValue('浏览详情时保留的草稿');await expect(panel).toContainText('保存文件 · 成功');
 for(const width of [1440,1024]){await p.setViewportSize({width,height:1000});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}assert.deepEqual(posts,[]);assert.deepEqual(f.sql('SELECT (SELECT count(*) FROM assistant_steps) steps,(SELECT count(*) FROM assistant_tool_calls) tools,(SELECT count(*) FROM operations) operations'),before);
});

test('historical input selection stays labeled across tabs and cannot replace a different conversation with a late response',{timeout:120000},async t=>{
 const f=await generatedFixture(t);await f.input();await f.runTurn();await f.input('只分析下一轮改进','PLAN');
 const other=(await f.call('/conversations',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({clientConversationId:randomUUID(),title:'另一个空任务'})})).body.result.conversationId;
 const {p,panel,posts}=await browser(t,f),history=p.getByRole('region',{name:'结果范围'}),historyButton=history.getByRole('button',{name:'历史结果',exact:true});
 await expect(panel).toContainText('只分析下一轮改进');
 await expect(panel).toContainText('等待执行');
 await p.getByRole('tab',{name:'成果',exact:true}).click();
 await expect(panel.getByRole('button',{name:'查看上次生成的网站'})).toBeVisible();
 await expect(panel).not.toContainText('index.html');
 await p.getByRole('tab',{name:'预览',exact:true}).click();
 await panel.getByRole('button',{name:'查看上次生成的网站'}).click();
 await expect(history.getByRole('status')).toContainText('正在查看历史结果');
 await expect(panel.getByRole('button',{name:'预览页面',exact:true})).toBeVisible();
 await f.runTurn();
 await p.getByRole('tab',{name:'成果',exact:true}).click();
 await expect(panel).toContainText('index.html');
 await history.getByRole('button',{name:'返回最新'}).click();
 await p.getByRole('tab',{name:'概览',exact:true}).click();
 await expect(panel).toContainText('只分析下一轮改进');
 await expect(historyButton).toHaveAttribute('aria-expanded','false');
 await expect(panel.getByRole('button',{name:'历史结果',exact:true})).toHaveCount(0);
 await historyButton.click();
 const list=history.getByRole('list',{name:'历史结果列表'});
 await list.getByRole('button',{name:/创建一个英语学习网站html/}).click();
 await expect(history.getByRole('status')).toContainText('正在查看历史结果');
 await expect(panel).toContainText('创建一个英语学习网站html');
 await p.getByRole('tab',{name:'成果',exact:true}).click();
 await expect(history.getByRole('status')).toContainText('正在查看历史结果');
 await expect(panel).toContainText('index.html');
 let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);t.after(()=>release());await p.route('**/api/v1/conversations/'+f.id+'/execution-details?*',async route=>{const response=await route.fetch();started();await gate;await route.fulfill({response});},{times:1});await ready;
 await p.getByRole('button',{name:'另一个空任务',exact:true}).click();await expect(p).toHaveURL(new RegExp('conversationId='+other));release();await p.getByRole('button',{name:'执行详情',exact:true}).click();await p.getByRole('tab',{name:'成果',exact:true}).click();await expect(panel).toContainText('本轮尚无助手执行记录');await expect(panel).not.toContainText('index.html');await expect(panel).not.toContainText('创建一个英语学习网站html');assert.deepEqual(posts,[]);
});
