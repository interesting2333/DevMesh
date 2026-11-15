import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {inputFixture} from '../fixtures/input-data.mjs';

const {chromium}=createRequire(new URL('../../templates/web-crud-v1/package.json',import.meta.url))('@playwright/test');
const project={principalId:'user_1',form:'project',projectId:null,runId:null,basisRevision:null};
async function harness(t,api){
  const source=await readFile('.cache/workbench-local-build/local.js','utf8');
  const server=createServer((req,res)=>{
    if(req.url==='/fixture/local.js'){res.setHeader('Content-Type','text/javascript');res.end(source);}
    else if(req.url==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Explicit local storage test harness</title>');}
    else if(api)api.app(req,res);
    else{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true}),context=await browser.newContext({extraHTTPHeaders:{authorization:'Bearer test_owner'}}),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  t.after(async()=>{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));assert.deepEqual(errors,[]);});
  async function open(page=undefined,principalId='user_1'){page??=await context.newPage();await page.goto(origin+'/fixture');await page.evaluate(async principalId=>{window.localModule=await import('/fixture/local.js');window.localStore=await window.localModule.openWorkbenchLocal(principalId);},principalId);return page;}
  t.diagnostic(JSON.stringify({browser:browser.version(),scope:'Actual Edge IndexedDB and compiled production local module in an explicit test harness. Optional actual Input API/file Worker; browser identity is a fixture. This does not test a workbench UI, OIDC, WebSocket, model or Runner.'}));
  return {context,open,origin};
}
const attempt=(page,method,args)=>page.evaluate(async({method,args})=>{try{return {ok:true,value:await window.localStore[method](...args)};}catch(e){return {ok:false,code:e.code??e.name};}},{method,args});

test('plan journal binds all reviewed conditions, locks across basis changes and accepts only the exact plan result',{timeout:120000},async t=>{
 const h=await harness(t),a=await h.open(),c={principalId:'user_1',form:'plan-confirm',projectId:'prj_plan',runId:'run_plan',basisRevision:3,basis:{planRevision:1,requirementRevision:2,reviewHash:'a'.repeat(64),carryForwardHash:'b'.repeat(64)}};
 assert((await attempt(a,'save',[c,0,{text:'',name:''}])).ok);assert.equal((await attempt(a,'enqueue',[c,1])).code,'LOCAL_RECORD_INVALID');assert((await attempt(a,'save',[c,1,{text:'CONFIRM_PLAN',name:''}])).ok);const q=(await attempt(a,'enqueue',[c,2])).value.command;assert.equal(q.envelope.path,'/api/v1/runs/run_plan/plans/1:confirm');assert.equal(q.envelope.ifMatch,'"r3"');assert.deepEqual(q.envelope.body,{requirementRevision:2,reviewHash:c.basis.reviewHash,carryForwardHash:c.basis.carryForwardHash});
 const changed={...c,basisRevision:4,basis:{...c.basis,planRevision:2,reviewHash:'c'.repeat(64)}};assert.equal((await attempt(a,'load',[changed])).value.pending.key,q.key);assert.equal((await attempt(a,'save',[changed,0,{text:'CONFIRM_PLAN',name:''}])).code,'COMMAND_PENDING');
 const message={principalId:'user_1',form:'message',projectId:c.projectId,runId:c.runId,basisRevision:3};assert((await attempt(a,'save',[message,0,{text:'独立消息草稿',name:''}])).ok);
 const receipt={operationId:'op_plan_fixture',status:'SUCCEEDED',result:{projectId:c.projectId,runId:c.runId,revision:4,planRevision:1}};assert.equal((await attempt(a,'observe',[q.key,{...receipt,result:{...receipt.result,planRevision:2}}])).code,'LOCAL_RECORD_INVALID');assert.equal((await attempt(a,'load',[changed])).value.pending.key,q.key);assert((await attempt(a,'observe',[q.key,receipt])).ok);assert.equal((await attempt(a,'load',[changed])).value.pending,null);assert.equal((await attempt(a,'load',[message])).value.draft.text,'独立消息草稿');assert.deepEqual((await attempt(a,'getCommand',[q.key])).value.envelope,q.envelope);assert.equal((await attempt(a,'load',[c])).value.draft.text,'');
});

test('old basis references paginate only exact form contexts without mutating drafts or pending originals',{timeout:120000},async t=>{
 const h=await harness(t),a=await h.open(),c={principalId:'user_1',form:'message',projectId:'prj_reference',runId:'run_reference',basisRevision:1};
 for(let n=1;n<=24;n++)assert((await attempt(a,'save',[{...c,basisRevision:n},0,{text:'旧依据 '+n,name:''}])).ok);
 assert((await attempt(a,'save',[{...c,runId:'run_foreign'},0,{text:'其他执行',name:''}])).ok);assert((await attempt(a,'save',[project,0,{text:'其他表单',name:''}])).ok);
 const queued=(await attempt(a,'enqueue',[c,1])).value.command,items=[];let cursor;
 do{const r=await attempt(a,'references',[{...c,basisRevision:25},cursor]);assert(r.ok);assert(r.value.items.length<=10);items.push(...r.value.items);cursor=r.value.nextCursor??undefined;}while(cursor);
 assert.equal(items.length,24);assert.equal(new Set(items.map(x=>x.key)).size,24);assert(items.every(d=>d.context.runId===c.runId&&d.context.form==='message'));assert.equal((await attempt(a,'load',[{...c,basisRevision:25}])).value.draft,null);assert.deepEqual((await attempt(a,'getCommand',[queued.key])).value.envelope,queued.envelope);assert.equal((await attempt(a,'references',[c,'foreign-cursor'])).code,'LOCAL_RECORD_INVALID');
 const withoutCurrent=(await attempt(a,'references',[{...c,basisRevision:9}])).value;assert(withoutCurrent.items.every(d=>d.context.basisRevision!==9));
});

test('real IndexedDB survives reload, isolates exact contexts and rejects competing stale page writes',{timeout:120000},async t=>{
  const h=await harness(t),a=await h.open();let r=await attempt(a,'save',[project,0,{text:'原始草稿 🧪\n第二行',name:'项目一'}]);assert(r.ok);assert.equal(r.value.revision,1);
  await h.open(a);assert.equal((await attempt(a,'load',[project])).value.draft.text,r.value.text);
  const b=await h.open(),results=await Promise.all([attempt(a,'save',[project,1,{text:'A 页',name:''}]),attempt(b,'save',[project,1,{text:'B 页',name:''}])]);assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.find(r=>!r.ok).code,'LOCAL_CONFLICT');const winner=results.find(r=>r.ok).value;assert.equal(winner.revision,2);assert.equal((await attempt(a,'load',[project])).value.draft.text,winner.text);
  const other=await h.open(undefined,'user_2'),foreign={...project,principalId:'user_2'};assert.equal((await attempt(other,'load',[foreign])).value.draft,null);assert.equal((await attempt(other,'load',[project])).code,'LOCAL_RECORD_INVALID');
  const c={principalId:'user_1',form:'message',projectId:'prj_first',runId:'run_first',basisRevision:1};assert((await attempt(a,'save',[c,0,{text:'Run 草稿',name:''}])).ok);
  for(const ctx of [{...c,projectId:'prj_other'},{...c,runId:'run_other'},{...c,basisRevision:2}])assert.equal((await attempt(a,'load',[ctx])).value.draft,null);
});

test('two pages admit one original request, actual project ACK loss reopens and exact replay retains one input',{timeout:120000},async t=>{
  const api=await inputFixture(t),h=await harness(t,api),a=await h.open(),b=await h.open();assert((await attempt(a,'save',[project,0,{text:'实际创建，保留原正文',name:'工作台基础'}])).ok);
  const queued=await Promise.all([attempt(a,'enqueue',[project,1]),attempt(b,'enqueue',[project,1])]);assert.equal(queued.filter(r=>r.ok).length,1);assert.equal(queued.find(r=>!r.ok).code,'COMMAND_PENDING');const original=queued.find(r=>r.ok).value.command,env=original.envelope;let posts=0;
  await a.route('**/api/v1/projects',async route=>{posts++;assert.equal(route.request().headers()['idempotency-key'],env.key);assert.deepEqual(route.request().postDataJSON(),env.body);const response=await route.fetch();assert.equal(response.status(),201);await route.abort('failed');},{times:1});
  const unknown=await a.evaluate(async e=>{try{await fetch(e.path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':e.key},body:JSON.stringify(e.body)});return false;}catch{return true;}},env);assert.equal(unknown,true);assert.equal(api.sql('SELECT count(*) n FROM projects')[0].n,1);
  await h.open(a);const reopened=(await attempt(a,'load',[project])).value;assert.deepEqual(reopened.pending,original);assert.equal(posts,1);assert.equal((await attempt(a,'save',[project,reopened.draft.revision,{text:'不得替换未知原正文',name:''}])).code,'COMMAND_PENDING');
  const receipt=await a.evaluate(async e=>{const response=await fetch('/api/v1/operations/lookup?scope='+encodeURIComponent(e.scope)+'&key='+e.key);if(response.status!==200)throw Error('Original lookup failed');return response.json();},env);assert.equal(receipt.status,'SUCCEEDED');
  const wrongResource={...receipt,resource:{projectId:receipt.result.projectId,runId:receipt.result.runId,revision:999},links:{operation:'/api/v1/operations/'+receipt.operationId}};assert.equal((await attempt(a,'observe',[env.key,wrongResource])).code,'LOCAL_RECORD_INVALID');assert.equal((await attempt(a,'load',[project])).value.pending.key,env.key);assert((await attempt(a,'observe',[env.key,receipt])).ok);
  const after=(await attempt(a,'load',[project])).value;assert.equal(after.pending,null);assert.equal(after.draft.text,'');assert.notEqual(after.draft.clientDraftId,env.body.clientDraftId);assert.deepEqual((await attempt(a,'getCommand',[env.key])).value.envelope,env);
  const replay=await a.evaluate(async e=>(await fetch(e.path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':e.key},body:JSON.stringify(e.body)})).json(),env);assert.deepEqual({operationId:replay.operationId,status:replay.status,result:replay.result},receipt);assert.deepEqual(replay.resource,{projectId:receipt.result.projectId,runId:receipt.result.runId,revision:receipt.result.revision});assert.equal(replay.links.operation,'/api/v1/operations/'+receipt.operationId);assert((await attempt(a,'observe',[env.key,replay])).ok);assert.equal(api.sql('SELECT count(*) n FROM projects')[0].n,1);assert.equal(api.sql('SELECT count(*) n FROM input_messages')[0].n,1);
  assert((await attempt(a,'observe',[env.key,receipt])).ok);assert.equal((await attempt(a,'observe',[env.key,{...receipt,operationId:'op_other'}])).code,'LOCAL_RECORD_INVALID');
});

test('message journal locks across changed Run basis and does not unlock on lookup miss or unknown observation',{timeout:120000},async t=>{
  const api=await inputFixture(t),created=await api.create(),p=created.body.result,h=await harness(t,api),a=await h.open(),c={principalId:'user_1',form:'message',projectId:p.projectId,runId:p.runId,basisRevision:1};
  assert((await attempt(a,'save',[c,0,{text:'实际补充消息',name:''}])).ok);const q=(await attempt(a,'enqueue',[c,1])).value.command,env=q.envelope,next={...c,basisRevision:2};assert.equal(env.ifMatch,'"r1"');
  assert.equal((await attempt(a,'load',[next])).value.pending.key,env.key);assert.equal((await attempt(a,'save',[next,0,{text:'不能绕过',name:''}])).code,'COMMAND_PENDING');
  const missing=await a.evaluate(async e=>(await fetch('/api/v1/operations/lookup?scope='+e.scope+'&key='+e.key)).status,env);assert.equal(missing,404);assert.deepEqual((await attempt(a,'getCommand',[env.key])).value.envelope,env);assert.equal((await attempt(a,'enqueue',[next,1])).code,'COMMAND_PENDING');
  const response=await a.evaluate(async e=>{const r=await fetch(e.path,{method:'POST',headers:{'content-type':'application/json','idempotency-key':e.key,'if-match':e.ifMatch},body:JSON.stringify(e.body)});return {status:r.status,receipt:await r.json()};},env);assert.equal(response.status,202);
  assert((await attempt(a,'observe',[env.key,{operationId:response.receipt.operationId,status:'OUTCOME_UNKNOWN',result:null}])).ok);assert.equal((await attempt(a,'load',[next])).value.pending.key,env.key);
  assert.equal((await attempt(a,'observe',[env.key,{...response.receipt,operationId:'op_other'}])).code,'LOCAL_RECORD_INVALID');assert((await attempt(a,'observe',[env.key,response.receipt])).ok);assert.equal((await attempt(a,'load',[next])).value.pending,null);assert.deepEqual((await attempt(a,'getCommand',[env.key])).value.envelope,env);assert.equal(api.sql('SELECT count(*) n FROM input_messages')[0].n,2);
});

test('real transaction abort rolls back both original command and draft pointer, and corrupt local records close admission',{timeout:120000},async t=>{
  const h=await harness(t),a=await h.open();assert((await attempt(a,'save',[project,0,{text:'原子提交',name:''}])).ok);
  await a.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){const request=original.call(this,value,...rest);if(this.name==='drafts'&&value.pendingKey){this.transaction.abort();IDBObjectStore.prototype.put=original;}return request;};});
  assert.equal((await attempt(a,'enqueue',[project,1])).code,'STORAGE_UNAVAILABLE');const state=(await attempt(a,'load',[project])).value;assert.equal(state.pending,null);assert.equal(state.draft.revision,1);assert.equal(state.draft.text,'原子提交');assert.equal(await a.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('devmesh.workbench',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('commands');const r=tx.objectStore('commands').count();r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);};})),0);
  await a.evaluate(async key=>{await new Promise((resolve,reject)=>{const q=indexedDB.open('devmesh.workbench',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts','readwrite'),s=tx.objectStore('drafts'),r=s.get(key);r.onsuccess=()=>s.put({...r.result,revision:'corrupt'});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};});},state.draft.key);
  assert.equal((await attempt(a,'load',[project])).code,'LOCAL_RECORD_INVALID');assert.equal((await attempt(a,'enqueue',[project,1])).code,'LOCAL_RECORD_INVALID');
  const c={principalId:'user_1',form:'message',projectId:'prj_integrity',runId:'run_integrity',basisRevision:1};assert((await attempt(a,'save',[c,0,{text:'严格原请求',name:''}])).ok);const queued=(await attempt(a,'enqueue',[c,1])).value.command;
  await a.evaluate(key=>new Promise((resolve,reject)=>{const q=indexedDB.open('devmesh.workbench',1);q.onsuccess=()=>{const db=q.result,tx=db.transaction('commands','readwrite'),s=tx.objectStore('commands'),r=s.get(key);r.onsuccess=()=>s.put({...r.result,envelope:{...r.result.envelope,path:'/api/v1/projects'}});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};}),queued.key);
  for(const [method,args]of [['load',[c]],['enqueue',[c,2]],['getCommand',[queued.key]]])assert.equal((await attempt(a,method,args)).code,'LOCAL_RECORD_INVALID');
});

test('version change closes old connections, blocked future upgrade retains old rows and old code refuses newer schema',{timeout:120000},async t=>{
  const h=await harness(t),a=await h.open(),b=await h.open();assert((await attempt(a,'save',[project,0,{text:'升级前原数据',name:''}])).ok);
  await b.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('devmesh.workbench',1);q.onsuccess=()=>{window.foreignConnection=q.result;resolve();};}));
  await a.evaluate(()=>{window.upgradeEvents=[];window.upgradeResult=new Promise((resolve,reject)=>{const q=indexedDB.open('devmesh.workbench',2);q.onblocked=()=>window.upgradeEvents.push('blocked');q.onupgradeneeded=()=>q.result.createObjectStore('future');q.onsuccess=()=>{q.result.close();resolve();};q.onerror=()=>reject(q.error);});});
  await a.waitForFunction(()=>window.upgradeEvents.includes('blocked'));assert.equal((await attempt(a,'load',[project])).code,'STORAGE_CLOSED');assert.equal((await attempt(b,'load',[project])).code,'STORAGE_CLOSED');await b.evaluate(()=>window.foreignConnection.close());await a.evaluate(()=>window.upgradeResult);
  assert.equal(await a.evaluate(async()=>{try{await window.localModule.openWorkbenchLocal('user_1');return null;}catch(e){return e.code;}}),'STORAGE_UNAVAILABLE');
  const saved=await a.evaluate(()=>new Promise(resolve=>{const q=indexedDB.open('devmesh.workbench',2);q.onsuccess=()=>{const db=q.result,tx=db.transaction('drafts'),r=tx.objectStore('drafts').getAll();r.onsuccess=()=>resolve(r.result);tx.oncomplete=()=>db.close();};}));assert.equal(saved.length,1);assert.equal(saved[0].text,'升级前原数据');
});

test('question journal rejects altered question/option bases, retains old originals and clears only its successful draft',{timeout:120000},async t=>{
 const h=await harness(t),page=await h.open(),c={principalId:'user_1',form:'questions-answer',projectId:'prj_answers',runId:'run_answers',basisRevision:4,basis:{requirementRevision:2,questions:[{questionId:'question_first',questionRevision:3,optionIds:['yes','no']}]}};
 assert((await attempt(page,'save',[c,0,{text:'',name:'',answers:[]}])).ok);assert.equal((await attempt(page,'enqueue',[c,1])).code,'LOCAL_RECORD_INVALID');
 for(const a of [{questionId:'question_other',questionRevision:3,value:'yes'},{questionId:'question_first',questionRevision:4,value:'yes'},{questionId:'question_first',questionRevision:3,value:'unsupported'}])assert.equal((await attempt(page,'save',[c,1,{text:'',name:'',answers:[a]}])).code,'LOCAL_RECORD_INVALID');
 const a={questionId:'question_first',questionRevision:3,value:'no'};assert((await attempt(page,'save',[c,1,{text:'',name:'',answers:[a]}])).ok);const q=(await attempt(page,'enqueue',[c,2])).value.command;assert.deepEqual(q.envelope.body,{answers:[a]});assert.equal(q.envelope.ifMatch,'"r4"');assert.equal(q.envelope.path,'/api/v1/runs/run_answers/questions:answer');
 const next={...c,basisRevision:5,basis:{...c.basis,questions:[{questionId:'question_first',questionRevision:4,optionIds:['yes','no']}]}};assert.equal((await attempt(page,'load',[next])).value.pending.key,q.key);assert.equal((await attempt(page,'save',[next,0,{text:'',name:'',answers:[]}])).code,'COMMAND_PENDING');
 const message={principalId:'user_1',form:'message',projectId:c.projectId,runId:c.runId,basisRevision:4};assert((await attempt(page,'save',[message,0,{text:'独立输入草稿',name:''}])).ok);const receipt={operationId:'op_answer_fixture',status:'SUCCEEDED',result:{projectId:c.projectId,runId:c.runId,revision:5,interpretationOperationId:'op_interpretation_fixture'}};
 assert.equal((await attempt(page,'observe',[q.key,{...receipt,result:{...receipt.result,runId:'run_foreign'}}])).code,'LOCAL_RECORD_INVALID');assert.equal((await attempt(page,'load',[next])).value.pending.key,q.key);assert((await attempt(page,'observe',[q.key,receipt])).ok);assert.deepEqual((await attempt(page,'getCommand',[q.key])).value.envelope,q.envelope);assert.equal((await attempt(page,'load',[next])).value.pending,null);assert.deepEqual((await attempt(page,'load',[c])).value.draft.answers,[]);assert.equal((await attempt(page,'load',[message])).value.draft.text,'独立输入草稿');
});
