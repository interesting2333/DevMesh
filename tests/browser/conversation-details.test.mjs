import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';
import {planConversation} from '../fixtures/conversation-desktop.mjs';
import {previewManagementFixture} from '../fixtures/preview-management.mjs';
import {PreviewLifecycleManager} from '../../packages/platform-core/dist/index.mjs';
import {meta} from '../fixtures/storage-data.mjs';
import {workbenchDeliveryFixture} from '../fixtures/workbench-delivery.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const capabilities={capabilities:()=>({model:true,preparation:true,execution:false,reason:null})},shots='project/evidence/P1-08/development/detail-remediation/screenshots';
async function conversation(f,{projectId,runId,title='需要核对的对话'}={}){
 const receipt=await f.storage.request('createConversation',{meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:randomUUID()},body:{clientConversationId:randomUUID(),title,...(projectId?{projectId}:{})}}),id=receipt.result.conversationId;
 await f.storage.request('appendConversationMessage',{meta:{principalId:'user_1',scopeId:id,idempotencyKey:randomUUID()},conversationId:id,body:{clientMessageId:randomUUID(),text:'核对本轮保存的需求与成果',attachmentIds:[],executionMode:'PLAN'}});
 if(runId){const t=await f.storage.request('claimConversationTurn',{workerId:'detail.test'}),claim={turnId:t.turnId,claimToken:t.claimToken};await f.storage.request('markConversationModelSent',{...claim,request:{fixture:true},reservedTokens:1,tokenLimit:10000});await f.storage.request('saveConversationResponse',{...claim,response:{reply:'已保存成果可在执行详情中核对。',intent:'QUERY',action:'NONE',goal:'',planOnly:false,answers:[]}});await f.storage.request('bindConversationRun',{...claim,projectId,runId});await f.storage.request('completeConversationTurn',{...claim,state:'WORKING'});}
 return id;
}
async function browser(t,origin,id,headers={}){const b=await chromium.launch({channel:'msedge',headless:true}),context=await b.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers}),p=await context.newPage(),errors=[],posts=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});t.after(async()=>{await b.close();assert.deepEqual(errors,[]);});await mkdir(shots,{recursive:true});await p.goto(origin+'/api/v1/workbench/view?conversationId='+id);await expect(p.locator('#conversation-input')).toBeEnabled();await p.getByRole('button',{name:'执行详情',exact:true}).click();return {p,context,posts};}
test('all five tabs remain available before a Run exists and preserve draft and attachment without POST',{timeout:90000},async t=>{
 const f=await inputFixture(t,{identityResolver:()=>({principalId:'user_1'}),conversations:capabilities}),id=await conversation(f),{p,posts}=await browser(t,f.origin,id),detail=p.getByRole('complementary',{name:'执行详情'});
 assert.deepEqual(await detail.getByRole('tab').allTextContents(),['概览','协作','成果','预览','记录']);await expect(detail.locator('.detail-context-summary')).toHaveCount(0);await expect(detail.locator('.detail-attention')).toHaveCount(0);await expect(detail.getByText('计划模式，审阅后再开始实现。',{exact:true})).toHaveCount(0);await expect(detail.getByText('执行模式，按本次任务授权推进。',{exact:true})).toHaveCount(0);await p.locator('#conversation-input').fill('切换页签时保留正文');await p.getByLabel('添加一个附件',{exact:true}).setInputFiles({name:'详情前的需求.md',mimeType:'text/markdown',buffer:Buffer.from('仍保留的原文件')});await expect(p.getByRole('article',{name:'已选附件：详情前的需求.md'})).toBeVisible();
 for(const name of ['协作','成果','预览','记录','概览']){await detail.getByRole('tab',{name,exact:true}).click();await expect(detail.getByRole('tab',{name,exact:true})).toHaveAttribute('aria-selected','true');await expect(detail.getByRole('tabpanel')).toBeVisible();await expect(p.locator('#conversation-input')).toHaveValue('切换页签时保留正文');}
 await detail.getByRole('tab',{name:'记录',exact:true}).click();await expect(detail.getByRole('tabpanel')).toContainText('当前对话尚未关联执行');await expect(detail.getByRole('tabpanel')).not.toContainText('核对本轮保存的需求与成果');await p.getByRole('button',{name:'收起执行详情',exact:true}).click();await p.getByRole('button',{name:'执行详情',exact:true}).click();await expect(detail.getByRole('tab',{name:'记录',exact:true})).toHaveAttribute('aria-selected','true');await detail.getByRole('tab',{name:'记录',exact:true}).press('Home');await expect(detail.getByRole('tab',{name:'概览',exact:true})).toBeFocused();await detail.getByRole('tab',{name:'概览',exact:true}).press('End');await expect(detail.getByRole('tab',{name:'记录',exact:true})).toBeFocused();await p.reload();await expect(p.locator('#conversation-input')).toHaveValue('切换页签时保留正文');await expect(p.getByRole('article',{name:'已选附件：详情前的需求.md'})).toBeVisible();assert.deepEqual(posts,[]);
});
test('bound tabs read actual collaboration, empty delivery and saved events, and full-plan action selects Task',{timeout:120000},async t=>{
 const f=await planConversation(t,{conversations:capabilities}),{p,posts}=await browser(t,f.base,f.id,{authorization:'Bearer user_1'}),detail=p.getByRole('complementary',{name:'执行详情'}),panel=detail.getByRole('tabpanel');
 await expect(detail.getByRole('status',{name:'需要注意'})).toContainText('等待你确认方案');await detail.getByRole('button',{name:'审阅方案',exact:true}).click();await expect(detail).toBeHidden();await expect(p.locator('#conversation-input')).toBeFocused();await p.getByRole('button',{name:'执行详情',exact:true}).click();await expect(panel.getByRole('region',{name:'需要你处理'})).toBeVisible();await expect(p.locator('#conversation-full-plan')).not.toHaveAttribute('open','');await p.screenshot({path:shots+'/overview.png'});await detail.getByRole('tab',{name:'协作',exact:true}).click();await expect(panel).toContainText('参与角色与工作');await expect(panel).toContainText('当前详情尚未接入 Agent 交接与工具调用记录');await expect(panel).not.toContainText('项目负责人');await p.screenshot({path:shots+'/collaboration.png'});
 await detail.getByRole('tab',{name:'成果',exact:true}).click();await expect(panel.getByText('此执行尚无已冻结候选。',{exact:true})).toBeVisible();await detail.getByRole('tab',{name:'预览',exact:true}).click();await expect(panel.getByRole('region',{name:'候选预览入口'})).toBeVisible();await expect(panel.getByText('此执行尚无已冻结候选。',{exact:true})).toBeVisible();
 await detail.getByRole('tab',{name:'记录',exact:true}).click();await expect(panel.getByRole('heading',{name:'执行记录',exact:true})).toBeVisible();await expect(panel).toContainText('方案已保存');await p.screenshot({path:shots+'/records.png'});await p.keyboard.press('Escape');await p.getByRole('button',{name:'查看完整方案',exact:true}).click();await expect(detail.getByRole('tab',{name:'概览',exact:true})).toHaveAttribute('aria-selected','true');await expect(p.locator('#conversation-full-plan')).toBeVisible();
 for(const width of [1600,1440,1280,1024]){await p.setViewportSize({width,height:1000});const bounds=await detail.getByRole('tablist').boundingBox();assert(bounds.width<=336);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:shots+'/task-'+width+'.png'});}assert.deepEqual(posts,[]);
});
test('results and preview reuse exact candidate selection and open dedicated pages while the conversation draft stays intact',{timeout:180000},async t=>{
 const f=await workbenchDeliveryFixture(t,{conversations:capabilities}),id=await conversation(f,{projectId:f.p.projectId,runId:f.p.runId}),{p,context,posts}=await browser(t,f.origin,id,{authorization:'Bearer fixture_owner'}),detail=p.getByRole('complementary',{name:'执行详情'}),panel=detail.getByRole('tabpanel');await p.locator('#conversation-input').fill('查看成果时保留这段草稿');const before=f.snapshot();
 await detail.getByRole('tab',{name:'成果',exact:true}).click();await panel.getByRole('button',{name:'选择候选 1',exact:true}).click();await expect(panel.getByRole('region',{name:'已选候选'})).toBeVisible();await panel.getByRole('button',{name:'查看效果',exact:true}).click();await expect(detail.getByRole('tab',{name:'预览',exact:true})).toHaveAttribute('aria-selected','true');await expect(panel.getByRole('region',{name:'已选候选'})).toBeVisible();await expect(panel.getByRole('button',{name:'逐项审查此候选',exact:true})).toHaveCount(0);await expect(panel.getByRole('region',{name:'项目已接受版本',exact:true})).toHaveCount(0);await expect(panel.getByRole('region',{name:'候选预览入口'})).toBeVisible();
 const opened=context.waitForEvent('page');await panel.getByRole('button',{name:/管理.*预览|查看预览条件与数据/}).click();const target=await opened;await target.waitForLoadState();await expect(target).toHaveURL(new RegExp('/runs/'+f.p.runId+'/candidates/'+f.candidate.candidateId+'/preview-management/view'));await target.close();await p.reload();await expect(p.locator('#conversation-input')).toBeEnabled();await p.getByRole('button',{name:'执行详情',exact:true}).click();await expect(detail.getByRole('tab',{name:'预览',exact:true})).toHaveAttribute('aria-selected','true');await expect(panel.getByRole('region',{name:'已选候选'})).toContainText('已选候选 1');await expect(p).toHaveURL(new RegExp('conversationId='+id));await expect(p.locator('#conversation-input')).toHaveValue('查看成果时保留这段草稿');await p.screenshot({path:shots+'/preview.png'});assert.equal(f.snapshot(),before);assert.deepEqual(posts,[]);
});
test('a late collaboration response cannot populate another conversation after navigation',{timeout:120000},async t=>{
 const f=await planConversation(t,{conversations:capabilities}),other=await conversation(f,{title:'另一个未绑定的对话'}),{p}=await browser(t,f.base,f.id,{authorization:'Bearer user_1'});let release,started;const blocked=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);
 await p.route('**/api/v1/runs/*/config-adjustments?*',async route=>{const response=await route.fetch();started();await blocked;await route.fulfill({response});},{times:1});await p.getByRole('tab',{name:'协作',exact:true}).click();await ready;await p.getByRole('button',{name:'另一个未绑定的对话',exact:true}).click();await expect(p).toHaveURL(new RegExp('conversationId='+other));release();await p.getByRole('button',{name:'执行详情',exact:true}).click();await p.getByRole('tab',{name:'协作',exact:true}).click();await expect(p.getByRole('tabpanel')).toContainText('任务关联项目后');await expect(p.getByRole('tabpanel')).not.toContainText('参与角色与工作');
});
test('revoked project access clears previously displayed detail data and records',{timeout:120000},async t=>{
 const f=await planConversation(t,{conversations:capabilities}),{p}=await browser(t,f.base,f.id,{authorization:'Bearer user_1'});await p.getByRole('tab',{name:'协作',exact:true}).click();await expect(p.getByRole('tabpanel')).toContainText('参与角色与工作');
 f.sql("DELETE FROM project_members WHERE project_id=? AND principal_id='user_1'",f.projectId);await p.getByRole('tab',{name:'记录',exact:true}).click();await expect(p.getByText('此任务不存在或已不可见，请重新进入。',{exact:true})).toBeVisible();await expect(p.getByRole('tabpanel')).not.toContainText('参与角色与工作');await expect(p.getByRole('tabpanel')).not.toContainText('先制定来源导航方案');
});


test('configuration failure is local to configuration and does not hide the actual roles or overview',{timeout:120000},async t=>{
 const f=await planConversation(t,{conversations:capabilities}),{p,posts}=await browser(t,f.base,f.id,{authorization:'Bearer user_1'}),panel=p.getByRole('tabpanel');
 await p.route('**/api/v1/runs/*/config-adjustments?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'EXPLICIT_CONFIGURATION_FAILURE'}})}));
 await p.getByRole('tab',{name:'协作',exact:true}).click();await expect(panel).toContainText('参与角色与工作');await panel.getByText('本次配置记录',{exact:true}).click();await expect(panel.getByRole('alert')).toHaveText('本次配置记录暂不可读。');await expect(panel).toContainText('实现来源导航');
 await p.getByRole('tab',{name:'概览',exact:true}).click();await expect(panel.getByRole('region',{name:'需要你处理'})).toBeVisible();await expect(panel.getByRole('region',{name:'需求变更'})).toContainText('本轮暂无需求变更提案');assert.deepEqual(posts,[]);
});

test('records identify unknown event types and keep the exact recent range without duplicating chat text',{timeout:120000},async t=>{
 const f=await planConversation(t,{conversations:capabilities}),{p,posts}=await browser(t,f.base,f.id,{authorization:'Bearer user_1'}),panel=p.getByRole('tabpanel');
 await p.route('**/api/v1/projects/*/runs/*/events?*',async route=>{const response=await route.fetch(),body=await response.json();assert(body.events.length);body.events[0].type='ExplicitUnknownFixtureEvent';await route.fulfill({response,json:body});});
 await p.getByRole('tab',{name:'记录',exact:true}).click();await expect(panel).toContainText('未识别的事件类型：ExplicitUnknownFixtureEvent');await expect(panel).toContainText('最多 50 条');await expect(panel).not.toContainText('先制定来源导航方案');await expect(panel.getByRole('button',{name:'回到已保存的对话',exact:true})).toBeVisible();assert.deepEqual(posts,[]);
});

test('preview read failures do not become an empty preview and preserve the exact selected candidate',{timeout:180000},async t=>{
 const f=await workbenchDeliveryFixture(t,{conversations:capabilities}),id=await conversation(f,{projectId:f.p.projectId,runId:f.p.runId}),{p,posts}=await browser(t,f.origin,id,{authorization:'Bearer fixture_owner'}),panel=p.getByRole('tabpanel');
 const before=f.snapshot();await p.getByRole('tab',{name:'成果',exact:true}).click();await panel.getByRole('button',{name:'选择候选 1',exact:true}).click();
 await p.route('**/candidates/*/preview-management?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'EXPLICIT_PREVIEW_FAILURE'}})}));await panel.getByRole('button',{name:'查看效果',exact:true}).click();
 await expect(panel.getByRole('alert')).toHaveText('暂时无法读取此版本的预览状态。');await expect(panel).not.toContainText('此版本尚无预览实例');await expect(panel.getByRole('region',{name:'已选候选'})).toContainText('已选候选 1');
 await p.unroute('**/candidates/*/preview-management?*');await panel.getByRole('button',{name:'重试读取预览',exact:true}).click();await expect(panel).toContainText('新预览创建尚未启用');await p.getByRole('tab',{name:'成果',exact:true}).click();await expect(panel.getByRole('region',{name:'已选候选'})).toContainText('已选候选 1');assert.equal(f.snapshot(),before);assert.deepEqual(posts,[]);
});


test('saved result opens its exact preview, and a healthy observation without an access gateway never offers Open App',{timeout:180000},async t=>{
 const h=await previewManagementFixture(t,{browser:true,empty:false,conversations:capabilities}),f=h.f;
 await h.content.putBytes(meta(),{kind:'content'},Buffer.from('用户需求原文'),'text/plain; charset=utf-8');
 const id=await conversation({storage:h.storage},{projectId:f.p.projectId,runId:f.p.runId}),{p,posts}=await browser(t,h.origin,id),panel=p.getByRole('tabpanel');
 await p.getByRole('button',{name:'收起执行详情',exact:true}).click();await p.getByRole('region',{name:'已保存成果',exact:true}).getByRole('button',{name:'查看效果',exact:true}).click();
 await expect(p.getByRole('tab',{name:'预览',exact:true})).toHaveAttribute('aria-selected','true');await expect(panel.getByRole('region',{name:'已选候选'})).toContainText('已选候选 1');await expect(panel.getByRole('region',{name:'应用预览状态'})).toContainText('启动中');
 const manager=new PreviewLifecycleManager(f.storage,f.principalId,f.backend);t.after(()=>manager.close());await manager.advance(f.preview.operationId);
 await expect(panel.getByRole('region',{name:'应用预览状态'})).toContainText('最近观察就绪',{timeout:15000});await expect(panel).toContainText('预览访问未配置');await expect(panel.getByRole('button',{name:'打开应用',exact:true})).toHaveCount(0);await expect(panel.getByRole('button',{name:'管理此候选预览与数据',exact:true})).toBeVisible();
 await p.screenshot({path:shots+'/preview-observed-no-access.png'});assert.deepEqual(posts,[]);
});
