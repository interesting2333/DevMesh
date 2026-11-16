import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {eventFixture} from '../fixtures/workbench-events.mjs';
import {RunControlCoordinator} from '../../packages/platform-core/dist/index.mjs';
const {chromium,expect:baseExpect}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test'),expect=baseExpect.configure({timeout:35000}),settings={timeout:120000};
const input=page=>page.getByLabel('输入正文',{exact:true}),connection=page=>page.getByRole('status',{name:'执行进展连接',exact:true}),saved=page=>expect(page.getByRole('status').filter({hasText:'草稿已保存在本机'})).toBeVisible();
async function harness(t,limits={}){
 const f=await eventFixture(t,{limits}),browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],csp=[],posts=[];
 f.state.resolver=()=>({principalId:f.state.principalId});page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('Content Security Policy'))csp.push(message.text());});page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);assert.deepEqual(csp,[]);});
 const open=async scope=>{await page.goto(f.origin+'/api/v1/workbench/view?'+new URLSearchParams({projectId:scope.projectId,runId:scope.runId}));await expect(input(page)).toBeEnabled();};
 t.diagnostic(JSON.stringify({browser:browser.version(),scope:'Real platform HTTP host, file SQLite Worker, native Edge WebSocket/IndexedDB/CSP. Explicit trusted identity and transport/history fault injection; no real OIDC, model, Linux or product acceptance.'}));
 return {f,page,context,open,posts};
}
async function append(f,scope,text){const value=await f.append(scope,text);assert.equal(value.response.status,202,JSON.stringify(value.body));}
async function journal(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('devmesh.workbench',2);request.onsuccess=()=>{const db=request.result,tx=db.transaction(['drafts','commands']),value={};for(const name of ['drafts','commands']){const q=tx.objectStore(name).getAll();q.onsuccess=()=>{value[name]=q.result;};}tx.oncomplete=()=>{db.close();resolve(value);};tx.onabort=()=>reject(tx.error);};request.onerror=()=>reject(request.error);}));}
async function focusSelection(page){await input(page).focus();await input(page).evaluate(element=>element.setSelectionRange(1,4));}
const selection=page=>input(page).evaluate(element=>({focus:document.activeElement===element,start:element.selectionStart,end:element.selectionEnd}));

test('native browser receives the snapshot-subscribe gap; progress and explicit refresh retain draft identity and selection',settings,async t=>{
 const h=await harness(t),{f,page}=h,scope=await f.create();let intercepted=false;
 await page.route('**/api/v1/projects/*/workspace?*',async route=>{const url=new URL(route.request().url());if(intercepted||url.searchParams.get('limit')!=='50')return route.continue();intercepted=true;const response=await route.fetch();assert.equal(response.status(),200);await append(f,scope,'快照后的准确消息');await route.fulfill({response});});
 await h.open(scope);await input(page).fill('原本机草稿 🧪');await saved(page);const before=await journal(page);await focusSelection(page);await expect(connection(page)).toContainText('收到 1 条新进展');assert.equal(intercepted,true);await expect(page.getByRole('region',{name:'已提交输入'})).not.toContainText('快照后的准确消息');assert.deepEqual(await selection(page),{focus:true,start:1,end:4});
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='查看更新').click());await expect(page.getByRole('region',{name:'已提交输入'})).toContainText('快照后的准确消息');await expect(input(page)).toHaveValue('原本机草稿 🧪');assert.deepEqual(await selection(page),{focus:true,start:1,end:4});await expect(connection(page)).toContainText('进展已连接');const after=await journal(page);assert.deepEqual(after,before);assert.equal(after.commands.length,0);assert.equal(h.posts.length,0);assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,2);
});

test('actual TCP disconnect triggers protected resnapshot and reconnect without resetting tab, draft or posting a command',settings,async t=>{
 const h=await harness(t),{f,page}=h,scope=await f.create();await h.open(scope);await expect(connection(page)).toContainText('进展已连接');await input(page).fill('重连保留的原草稿');await saved(page);await page.getByRole('tab',{name:'记录',exact:true}).click();await focusSelection(page);const before=await journal(page),reached=Promise.withResolvers(),release=Promise.withResolvers();t.after(()=>release.resolve());let snapshots=0;
 await page.route('**/api/v1/projects/*/workspace?*',async route=>{if(new URL(route.request().url()).searchParams.get('limit')!=='1')return route.continue();snapshots++;reached.resolve();await release.promise;await route.continue();},{times:1});
 f.state.upgradeSockets.at(-1).destroy();await reached.promise;await append(f,scope,'断线期间的消息');release.resolve();await expect(connection(page)).toContainText('收到 1 条新进展');await append(f,scope,'重连之后的消息');await expect(connection(page)).toContainText('收到 2 条新进展');assert.equal(snapshots,1);await expect(page.getByRole('tab',{name:'记录',exact:true})).toHaveAttribute('aria-selected','true');await expect(input(page)).toHaveValue('重连保留的原草稿');assert.deepEqual(await selection(page),{focus:true,start:1,end:4});assert.deepEqual(await journal(page),before);assert.equal(h.posts.length,0);
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='查看更新').click());const messages=page.getByRole('region',{name:'已提交输入'});await expect(messages).toContainText('重连之后的消息');assert.equal(await messages.locator('article').count(),3);assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,3);
});

test('reordered and duplicated real server frames fill the HTTP gap and apply each persisted event once',settings,async t=>{
 const h=await harness(t),{f,page}=h,scope=await f.create();let held=null,injected=0,gapReads=0,enabled=true;
 await page.routeWebSocket(url=>url.pathname==='/events',route=>{const upstream=route.connectToServer();upstream.onMessage(raw=>{const frame=JSON.parse(raw.toString());if(enabled&&frame.kind==='domain-event'){if(held===null){held=raw;return;}route.send(raw);route.send(held);route.send(raw);held=null;enabled=false;injected++;return;}if(held!==null&&frame.kind==='caught-up')return;route.send(raw);});});
 await page.route('**/api/v1/projects/*/runs/*/events?*',route=>{gapReads++;return route.continue();});await h.open(scope);await expect(connection(page)).toContainText('进展已连接');await input(page).fill('乱序期间仍编辑');await saved(page);await page.getByRole('tab',{name:'记录',exact:true}).click();await focusSelection(page);await append(f,scope,'第一条实际提交');await append(f,scope,'第二条实际提交');await expect(connection(page)).toContainText('收到 2 条新进展');await expect(page.getByRole('region',{name:'最近执行进展'}).getByRole('listitem')).toHaveCount(2);assert.equal(injected,1);assert(gapReads>0);assert.deepEqual(await selection(page),{focus:true,start:1,end:4});assert.equal(h.posts.length,0);assert.equal((await journal(page)).commands.length,0);assert.equal(f.sql('SELECT count(*) n FROM events WHERE run_id=?',scope.runId)[0].n,3);
});

test('actual server buffer overflow resynchronizes from a fresh snapshot while preserving editing',settings,async t=>{
 const h=await harness(t,{maximumPendingWakeups:1}),{f,page}=h,scope=await f.create(),gate=f.gateWindow();await h.open(scope);await gate.reached;await input(page).fill('溢出期间的输入');await saved(page);await focusSelection(page);const before=await journal(page);await append(f,scope,'溢出一');await append(f,scope,'溢出二');await expect(connection(page)).toContainText('收到 2 条新进展');gate.restore();assert.deepEqual(await journal(page),before);await expect(input(page)).toHaveValue('溢出期间的输入');assert.deepEqual(await selection(page),{focus:true,start:1,end:4});assert.equal(h.posts.length,0);assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,3);
});

test('idle server-side revocation clears protected UI without refresh and never submits local drafts',settings,async t=>{
 const h=await harness(t,{reauthorizeMs:50}),{f,page}=h,scope=await f.create();await h.open(scope);await expect(connection(page)).toContainText('进展已连接');await input(page).fill('撤权前保存在本机');await saved(page);const before=await journal(page);f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',scope.projectId,'user_1');await expect(page.getByRole('link',{name:'重新进入工作台',exact:true})).toBeVisible();await expect(page.getByRole('region',{name:'已提交输入'})).toHaveCount(0);await expect(input(page)).toHaveCount(0);assert.deepEqual(await journal(page),before);assert.equal(h.posts.length,0);assert.equal(f.sql('SELECT count(*) n FROM input_messages')[0].n,1);
});

test('repeated successful resnapshots with corrupt frames stop after a bounded budget and explicit retry recovers',settings,async t=>{
 const h=await harness(t),{f,page}=h,scope=await f.create();let corrupt=true,snapshots=0,connections=0;
 await page.route('**/api/v1/projects/*/workspace?*',route=>{if(new URL(route.request().url()).searchParams.get('limit')==='1')snapshots++;return route.continue();});
 await page.routeWebSocket(url=>url.pathname==='/events',route=>{connections++;const upstream=route.connectToServer();upstream.onMessage(raw=>{route.send(raw);if(corrupt&&JSON.parse(raw.toString()).kind==='caught-up')route.send(JSON.stringify({kind:'invalid-frame',projectId:scope.projectId,runId:scope.runId}));});});
 await h.open(scope);await expect(connection(page)).toContainText('重新连接进展');assert.equal(snapshots,5);assert.equal(connections,6);assert.equal(h.posts.length,0);assert.equal((await journal(page)).commands.length,0);
 corrupt=false;await page.getByRole('button',{name:'重新连接进展',exact:true}).click();await expect(connection(page)).toContainText('进展已连接');assert.equal(snapshots,6);assert.equal(connections,7);await append(f,scope,'恢复后仍接收真实进展');await expect(connection(page)).toContainText('收到 1 条新进展');assert.equal(h.posts.length,0);
});

test('workbench shows real control state after an actual disconnect and resnapshot',settings,async t=>{
  const h=await harness(t),{f,page}=h,scope=await f.create();await h.open(scope);await expect(connection(page)).toContainText('进展已连接');
  const run=await f.storage.request('getRun',{runId:scope.runId});
  await f.storage.request('pauseRun',{meta:{principalId:'user_1',scopeId:scope.runId,idempotencyKey:randomUUID()},runId:scope.runId,controlRevision:run.controlRevision});
  const controlStatus=page.getByRole('status',{name:'执行控制状态'});
  await expect(controlStatus).toContainText('正在暂停，等待收尾');
  f.state.upgradeSockets.at(-1).destroy();
  await expect(connection(page)).toContainText(/进展已连接|收到 \d+ 条新进展/);
  await expect(controlStatus).toContainText('正在暂停，等待收尾');
});

test('workbench collaboration tab shows change and config summaries',settings,async t=>{
  const h=await harness(t),{f,page}=h,scope=await f.create();
  const run=await f.storage.request('getRun',{runId:scope.runId});
  await f.storage.request('proposeChange',{meta:{principalId:'user_1',scopeId:scope.runId,idempotencyKey:randomUUID()},runId:scope.runId,ifMatch:'"r'+run.resourceRevision+'"',sourceMessageId:'message_collab',proposedText:'扩展协作范围'});
  await h.open(scope);
  await page.getByRole('tab',{name:'协作'}).click();
  const summary=page.getByLabel('变更与配置');
  await expect(summary).toContainText('变更提案 1 条');
  await expect(summary).toContainText('扩展协作范围');
  await expect(summary).toContainText('配置代际');
});

test('workbench more menu opens model settings and saves configuration',settings,async t=>{
  const h=await harness(t),{f,page}=h,scope=await f.create();await h.open(scope);
  await page.getByRole('button',{name:'更多'}).click();
  await page.getByRole('menuitem',{name:'设置'}).click();
  const dialog=page.getByRole('dialog',{name:'设置'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('模型 ID').fill('deepseek-chat');
  await dialog.getByLabel('API Key').fill('sk-test-browser');
  await dialog.getByRole('button',{name:'保存设置'}).click();
  await expect(dialog.getByRole('status')).toContainText('已保存');
  await expect(dialog).toContainText('已配置 deepseek-chat');
});

test('workbench pause and resume controls call the real API and keep the state across reconnect',settings,async t=>{
  const h=await harness(t),{f,page}=h,scope=await f.create();await h.open(scope);
  const controlStatus=page.getByRole('status',{name:'执行控制状态'});
  await expect(controlStatus).toContainText('执行已恢复');
  await controlStatus.getByRole('button',{name:'暂停执行',exact:true}).click();
  await expect(controlStatus).toContainText('正在暂停，等待收尾');
  const coordinator=new RunControlCoordinator(f.storage,{configured:true,async stop(){throw Error('no targets expected');}},{principalId:'coordinator.local'});
  await coordinator.tick();
  await expect(controlStatus).toContainText('已暂停');
  f.state.upgradeSockets.at(-1).destroy();
  await expect(controlStatus).toContainText('已暂停');
  await controlStatus.getByRole('button',{name:'恢复执行',exact:true}).click();
  await expect(controlStatus).toContainText('执行已恢复');
});
