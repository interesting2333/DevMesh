import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';
import {ConversationRuntime,providerConfigSchema} from '../../packages/agent-runtime/dist/index.mjs';
const {chromium,expect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const model=(complete)=>({config:providerConfigSchema.parse({providerId:'conversation.browser',model:'fixture',endpoint:'http://127.0.0.1:1',credentialRef:'fixture.key',capabilities:{revision:'v1',contextTokens:65536,maxOutputTokens:4096,toolCalls:false,structuredOutput:'json-object',tokenCounting:'utf8-conservative-v1',reasoningMode:'disabled',verification:'DECLARED'}}),complete:async(req,signal)=>({content:JSON.stringify(await complete(req,signal)),toolCalls:[],finishReason:'stop',requestId:randomUUID(),usage:{inputTokens:50,outputTokens:30,source:'provider'},model:'fixture',cost:null})});
const reply=(text='我理解你想讨论内部工单的权限，可以先按员工和处理人区分。')=>({reply:text,intent:'QUERY',action:'NONE',goal:'',planOnly:false,answers:[]});
async function harness(t,provider=model(()=>reply())){
 let runtime;const f=await inputFixture(t,{identityResolver:()=>({principalId:'user_1'}),conversations:{capabilities:()=>runtime.capabilities(),control:(...args)=>runtime.control(...args)}});
 runtime=new ConversationRuntime(f.storage,f.content,{baseline:{version:'1.0.0',baseCommit:'b'.repeat(40)},provider:()=>provider??undefined,preparation:()=>true,execution:()=>false});await runtime.start();
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:{width:1600,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{await browser.close();await runtime.stop();assert.deepEqual(errors,[]);});await mkdir('.cache/conversation/screenshots',{recursive:true});await page.goto(f.origin+'/api/v1/workbench/view');await expect(page.locator('#conversation-input')).toBeEnabled();
 return {...f,runtime,page,context};
}
async function saved(page,text){await page.waitForFunction(async text=>new Promise(resolve=>{const r=indexedDB.open('devmesh.conversations',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts'),q=tx.objectStore('drafts').getAll();q.onsuccess=()=>{const found=q.result.some(d=>d.text===text);tx.oncomplete=()=>{db.close();resolve(found);};};};}),text);}

test('actual conversation shows a saved assistant answer, restores draft and retains mobile input without a planning dashboard',{timeout:60000},async t=>{
 const f=await harness(t),p=f.page;await expect(p.getByRole('heading',{name:'想完成什么任务？'})).toBeVisible();await p.screenshot({path:'.cache/conversation/screenshots/homepage-1600.png'});
 await p.locator('#conversation-input').fill('权限一般怎么设计？');await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p).toHaveURL(/conversationId=/);await expect(p.getByText(/我理解你想讨论内部工单的权限/)).toBeVisible();
 await expect(p.getByText('项目下一目标',{exact:true})).toHaveCount(0);await expect(p.getByText('已有输入等待后台处理。',{exact:true})).toHaveCount(0);await expect(p.getByRole('button',{name:'返回上一级',exact:true})).toHaveCount(0);assert.equal(f.sql('SELECT count(*) n FROM projects')[0].n,0);
 await p.locator('#conversation-input').fill('保留正在编辑的补充');await saved(p,'保留正在编辑的补充');await p.reload();await expect(p.locator('#conversation-input')).toHaveValue('保留正在编辑的补充');await expect(p.getByText(/我理解你想讨论内部工单的权限/)).toBeVisible();await p.screenshot({path:'.cache/conversation/screenshots/conversation-1600.png'});
 await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'执行详情',exact:true}).click();await expect(p.getByRole('complementary',{name:'执行详情'})).toBeVisible();await p.keyboard.press('Escape');await expect(p.locator('#conversation-input')).toHaveValue('保留正在编辑的补充');const bounds=await p.getByRole('button',{name:'发送',exact:true}).boundingBox();assert(bounds.y+bounds.height<=844);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.screenshot({path:'.cache/conversation/screenshots/conversation-390.png'});
});

test('lost message acknowledgement reload never reposts; explicit original lookup recovers one message and one reply',{timeout:60000},async t=>{
 const f=await harness(t),p=f.page;let posts=0;p.on('request',r=>{if(r.method()==='POST'&&/conversations\/.+\/messages/.test(r.url()))posts++;});
 await p.route('**/api/v1/conversations/*/messages',async route=>{assert.equal((await route.fetch()).status(),202);await route.abort('failed');},{times:1});
 await p.locator('#conversation-input').fill('这是丢回执测试');await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p.getByRole('button',{name:'核实并继续原请求'})).toBeVisible();await p.reload();await expect(p.getByRole('button',{name:'核实并继续原请求'})).toBeVisible();assert.equal(posts,1);
 await p.getByRole('button',{name:'核实并继续原请求'}).click();await expect(p).toHaveURL(/conversationId=/);await expect(p.getByText(/我理解你想讨论内部工单的权限/)).toBeVisible();assert.equal(posts,1);assert.equal(f.sql("SELECT count(*) n FROM conversation_messages WHERE role='user'")[0].n,1);assert.equal(f.sql("SELECT count(*) n FROM conversation_messages WHERE role='assistant'")[0].n,1);
});

test('selecting a file stays local, file-only send uploads exact original bytes, and invalid file remains recoverable',{timeout:60000},async t=>{
 const f=await harness(t),p=f.page;let uploads=0;p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/attachments'))uploads++;});const bytes=Buffer.from('# 需求\n内部工单权限。');await p.getByLabel('添加一个附件',{exact:true}).setInputFiles({name:'需求.md',mimeType:'text/markdown',buffer:bytes});await expect(p.getByRole('article',{name:'已选附件：需求.md'})).toBeVisible();assert.equal(uploads,0);
 await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p).toHaveURL(/conversationId=/);await expect(p.getByText(/我理解你想讨论内部工单的权限/)).toBeVisible();assert.equal(uploads,1);assert.equal(f.sql('SELECT byte_size FROM attachments')[0].byte_size,bytes.length);assert.equal(JSON.parse(f.sql("SELECT attachments_json FROM conversation_messages WHERE role='user'")[0].attachments_json).length,1);
 await p.getByRole('button',{name:/^工作空间：/}).click();await p.getByRole('menuitem',{name:'附件管理'}).click();await p.getByRole('button',{name:'复制到当前输入',exact:true}).click();await expect(p.getByRole('article',{name:'已选附件：需求.md'})).toBeVisible();assert.equal(uploads,1);
 const originals=await p.evaluate(()=>new Promise(resolve=>{const r=indexedDB.open('devmesh.conversations',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('files'),q=tx.objectStore('files').getAll();q.onsuccess=()=>{const rows=q.result;tx.oncomplete=()=>{db.close();resolve(rows);};};};}));assert.equal(originals.length,2);assert.equal(new Set(originals.map(f=>f.uploadKey)).size,2);assert.equal(new Set(originals.map(f=>f.clientAttachmentId)).size,2);
 await p.getByLabel('添加一个附件',{exact:true}).setInputFiles({name:'不能处理.png',mimeType:'image/png',buffer:Buffer.from('invalid')});await expect(p.getByText('尚未保存的文件：不能处理.png',{exact:true})).toBeVisible();await expect(p.getByRole('button',{name:'发送',exact:true})).toBeDisabled();assert.equal(uploads,1);
});

test('missing model explains the actual saved-input block without a fictitious assistant answer',{timeout:60000},async t=>{
 const f=await harness(t,null),p=f.page;await p.locator('#conversation-input').fill('帮我做工单系统');await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p.getByText(/需求已保存，当前服务尚未接入模型/)).toBeVisible();await expect(p.getByRole('button',{name:'打开模型设置',exact:true})).toBeVisible();assert.equal(f.sql("SELECT count(*) n FROM conversation_messages WHERE role='assistant'")[0].n,0);
});

test('lost upload acknowledgement recovers the original upload before sending one file-only message',{timeout:60000},async t=>{
 const f=await harness(t),p=f.page;let uploads=0;p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/attachments'))uploads++;});
 await p.route('**/api/v1/attachments',async route=>{if(route.request().method()==='POST'){assert.equal((await route.fetch()).status(),201);await route.abort('failed');}else await route.continue();},{times:1});
 await p.getByLabel('添加一个附件',{exact:true}).setInputFiles({name:'原始需求.md',mimeType:'text/markdown',buffer:Buffer.from('原始需求，不能重建上传身份。')});await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p.getByRole('button',{name:'核实并继续原请求'})).toBeVisible();await p.reload();assert.equal(uploads,1);await p.getByRole('button',{name:'核实并继续原请求'}).click();await expect(p).toHaveURL(/conversationId=/);assert.equal(uploads,1);assert.equal(f.sql('SELECT count(*) n FROM attachments')[0].n,1);
});

test('an IndexedDB transaction abort retains typed text and allows an explicit save retry',{timeout:60000},async t=>{
 const f=await harness(t),p=f.page;
 await p.evaluate(()=>{const put=IDBObjectStore.prototype.put;window.rejectConversationSave=true;IDBObjectStore.prototype.put=function(value,...args){if(window.rejectConversationSave&&this.name==='drafts'&&value.text==='事务失败仍需保留'){this.transaction.abort();throw new DOMException('controlled abort','AbortError');}return put.call(this,value,...args);};});
 await p.locator('#conversation-input').fill('事务失败仍需保留');await expect(p.getByRole('button',{name:'重试保存本页输入'})).toBeVisible();await expect(p.locator('#conversation-input')).toHaveValue('事务失败仍需保留');await expect(p.getByRole('button',{name:'发送',exact:true})).toBeDisabled();
 await p.evaluate(()=>{window.rejectConversationSave=false;});await p.getByRole('button',{name:'重试保存本页输入'}).click();await saved(p,'事务失败仍需保留');await p.reload();await expect(p.locator('#conversation-input')).toHaveValue('事务失败仍需保留');assert.equal(f.sql('SELECT count(*) n FROM conversations')[0].n,0);
});

test('two tabs require an explicit draft conflict choice and preserve both visible inputs',{timeout:60000},async t=>{
 const f=await harness(t),p=f.page,second=await f.context.newPage();await second.goto(f.origin+'/api/v1/workbench/view');await expect(second.locator('#conversation-input')).toBeEnabled();
 await p.locator('#conversation-input').fill('第一页输入');await saved(p,'第一页输入');await second.locator('#conversation-input').fill('第二页输入');await expect(second.getByRole('button',{name:'重试保存本页输入'})).toBeVisible();await expect(p.locator('#conversation-input')).toHaveValue('第一页输入');await expect(second.locator('#conversation-input')).toHaveValue('第二页输入');await second.getByRole('button',{name:'重试保存本页输入'}).click();await expect(second.getByText('另页已保存：第一页输入',{exact:true})).toBeVisible();await second.getByRole('button',{name:'使用已保存内容'}).click();await expect(second.locator('#conversation-input')).toHaveValue('第一页输入');await second.close();
});

test('lost pause acknowledgement is recovered from its original control after reload without a second control POST',{timeout:60000},async t=>{
 const f=await harness(t,model(async(_req,signal)=>{await new Promise(resolve=>{if(signal.aborted)resolve();else signal.addEventListener('abort',resolve,{once:true});});return reply();})),p=f.page;let controls=0;p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/control'))controls++;});
 await p.locator('#conversation-input').fill('先讨论一个问题');await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p).toHaveURL(/conversationId=/);
 await p.route('**/api/v1/conversations/*/control',async route=>{assert.equal((await route.fetch()).status(),202);await route.abort('failed');},{times:1});await p.getByRole('button',{name:'暂停',exact:true}).click();await expect(p.getByRole('button',{name:'核实原控制请求'})).toBeVisible();await p.reload();await expect(p.getByRole('button',{name:'核实原控制请求'})).toBeVisible();assert.equal(controls,1);await p.getByRole('button',{name:'核实原控制请求'}).click();await expect(p.getByRole('button',{name:'核实原控制请求'})).toHaveCount(0);assert.equal(controls,1);await expect(p.getByRole('status').filter({hasText:'任务已暂停'})).toBeVisible();
});

test('a long assistant reply follows the bottom while preserving composer focus',{timeout:60000},async t=>{
 const f=await harness(t,model(()=>reply(Array.from({length:60},(_,i)=>'权限说明第 '+(i+1)+' 项：根据业务职责确定可查看和可处理范围。').join('\n')))),p=f.page;
 await p.locator('#conversation-input').fill('请详细说明权限设计');await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p.locator('.chat-assistant')).toHaveCount(1);await p.waitForFunction(()=>{const e=document.querySelector('.conversation-output');return e.scrollTop>100&&e.scrollHeight-e.scrollTop-e.clientHeight<4;});assert.equal(await p.evaluate(()=>document.activeElement?.id),'conversation-input');
});

test('assistant paragraphs, emphasis, lists and code are readable while embedded HTML stays literal',{timeout:60000},async t=>{
 const f=await harness(t,model(()=>reply('## 权限建议\n\n按**业务职责**划分。\n\n- 员工提交\n- 处理人受理\n\n```html\n<script>window.replyExecuted=1</script>\n```'))),p=f.page;await p.locator('#conversation-input').fill('如何划分权限？');await p.getByRole('button',{name:'发送',exact:true}).click();await expect(p.locator('.chat-assistant')).toHaveCount(1);await expect(p.getByRole('heading',{name:'权限建议'})).toBeVisible();assert.equal(await p.locator('.chat-assistant strong').textContent(),'业务职责');assert.equal(await p.locator('.chat-assistant li').count(),2);await expect(p.locator('.chat-assistant pre')).toContainText('<script>window.replyExecuted=1</script>');assert.equal(await p.evaluate(()=>window.replyExecuted),undefined);
});
