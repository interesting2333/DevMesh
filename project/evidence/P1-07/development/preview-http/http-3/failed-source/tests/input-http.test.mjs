import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {request as httpRequest} from 'node:http';
import {inputFixture} from './fixtures/input-data.mjs';
import {createProjectInput,saveMessageInput,operationReceipt,workspaceView,errorEnvelope} from '../packages/contracts/dist/index.js';

test('input contracts preserve Unicode and original whitespace while enforcing nonempty material',()=>{
  const draft={initialRequest:{text:'🧪'.repeat(20000),attachmentIds:[]},clientDraftId:randomUUID()};
  assert.equal(createProjectInput.safeParse(draft).success,true);
  assert.equal(createProjectInput.safeParse({...draft,initialRequest:{text:'🧪'.repeat(20001),attachmentIds:[]}}).success,false);
  assert.equal(createProjectInput.safeParse({...draft,initialRequest:{text:' \n',attachmentIds:[]}}).success,false);
  assert.equal(createProjectInput.safeParse({...draft,initialRequest:{text:'',attachmentIds:['attachment_material']}}).success,true);
  assert.equal(createProjectInput.safeParse({...draft,principalId:'self_reported'}).success,false);
  assert.equal(saveMessageInput.safeParse({text:' ',attachmentIds:[],clientMessageId:randomUUID()}).success,false);
});

test('input HTTP rejects missing identity, forged user fields, Origin and oversized JSON without business facts',{timeout:240000},async t=>{
  const f=await inputFixture(t);
  const anonymous=await f.call('/projects',{headers:{authorization:''}});assert.equal(anonymous.response.status,401);assert.equal(errorEnvelope.safeParse(anonymous.body).success,true);
  const forged=await f.create({principalId:'user_2'});assert.equal(forged.response.status,422);
  const cross=await f.call('/projects',{headers:{origin:'http://attacker.invalid'}});assert.equal(cross.response.status,403);
  const large=await f.call('/projects',{method:'POST',headers:{'content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({payload:'a'.repeat(256*1024)})});assert.equal(large.response.status,413);
  const info=await f.storage.request('inspect',{});assert.equal(info.counts.projects,0);assert.equal(info.counts.runs,0);assert.equal(info.counts.upload_intakes,0);
  const noAuth=await inputFixture(t,{identityResolver:undefined});const response=await noAuth.call('/projects');assert.equal(response.response.status,503);assert.equal(response.body.error.code,'IDENTITY_NOT_CONFIGURED');
});

test('real HTTP project admission is atomic, duplicate clicks share one result, and queries enforce current membership',{timeout:240000},async t=>{
  const f=await inputFixture(t),key=randomUUID(),clientDraftId=randomUUID(),body={initialRequest:{text:'  保留原文 🧪\n',attachmentIds:[]},clientDraftId};
  const [a,b]=await Promise.all([f.create(body,key),f.create(body,key)]);assert.equal(a.response.status,201,JSON.stringify(a.body));assert.equal(b.response.status,201,JSON.stringify(b.body));assert.equal(a.body.operationId,b.body.operationId);assert.equal(operationReceipt.safeParse(a.body).success,true);
  const p=a.body.result,info=await f.storage.request('inspect',{});assert.equal(info.counts.projects,1);assert.equal(info.counts.runs,1);assert.equal(info.counts.input_messages,1);assert.equal(info.counts.input_processing,1);assert.equal(info.counts.outbox,1);
  const processing=await f.call(`/operations/${p.understandingOperationId}`);assert.equal(processing.body.status,'WAITING');
  const workspace=await f.call(`/projects/${p.projectId}/workspace`);assert.equal(workspace.response.status,200,JSON.stringify(workspace.body));assert.equal(workspaceView.safeParse(workspace.body).success,true);assert.equal(workspace.body.messages[0].text,body.initialRequest.text);assert.equal(workspace.body.eventCursor,1);assert.equal(workspace.response.headers.get('etag'),'"r1"');
  const hidden=await f.call(`/projects/${p.projectId}/workspace`,{headers:{authorization:'Bearer test_other'}});assert.equal(hidden.response.status,404);
  const changed=await f.create({...body,name:'不同名称'},key);assert.equal(changed.response.status,409);
  f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',p.projectId,'user_1');
  const revoked=await f.call(`/operations/${a.body.operationId}`);assert.equal(revoked.response.status,404);
  const replay=await f.create(body,key);assert.equal(replay.response.status,404);
});

test('saved messages deduplicate before stale CAS, remain paused and emit consistent snapshot cursors',{timeout:240000},async t=>{
  const f=await inputFixture(t),created=await f.create(),p=created.body.result;
  await f.storage.request('setControlIntent',{meta:{principalId:'user_1',scopeId:p.runId,idempotencyKey:randomUUID()},runId:p.runId,ifMatch:'"r1"',action:'pause'});
  const key=randomUUID(),body={text:'  暂停时补充\n',attachmentIds:[],clientMessageId:randomUUID(),intentHint:'change'};
  const post=(etag='"r2"',token='test_owner',requestKey=key)=>f.call(`/runs/${p.runId}/messages`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','idempotency-key':requestKey,'if-match':etag},body:JSON.stringify(body)});
  const first=await post();assert.equal(first.response.status,202,JSON.stringify(first.body));const repeated=await post();assert.equal(repeated.response.status,202);assert.equal(repeated.body.operationId,first.body.operationId);
  const stale=await post('"r2"','test_owner',randomUUID());assert.equal(stale.response.status,412);
  f.sql('INSERT INTO project_members VALUES(?,?,?,?)',p.projectId,'viewer_1','viewer',new Date().toISOString());
  const viewer=await post('"r3"','test_viewer',randomUUID());assert.equal(viewer.response.status,403);
  const workspace=await f.call(`/projects/${p.projectId}/workspace`);assert.equal(workspace.body.run.controlGate,'PAUSED');assert.equal(workspace.body.run.resourceRevision,3);assert.equal(workspace.body.messages.length,2);assert.equal(workspace.body.messages[1].text,body.text);assert.equal(workspace.body.messages[1].intentHint,'change');
  const events=await f.call(`/projects/${p.projectId}/runs/${p.runId}/events?afterSeq=1`);assert.equal(events.body.nextCursor,workspace.body.eventCursor);assert.deepEqual(events.body.events.map(e=>e.seq),[2,3]);
  const noChange=await f.storage.request('inspect',{});assert.equal(noChange.counts.plan_confirmations,0);assert.equal(noChange.counts.attempts,0);
});

test('attachments are independent, bounded, owned, and become immutable material only after T1',{timeout:240000},async t=>{
  const f=await inputFixture(t),key=randomUUID(),clientAttachmentId=randomUUID();
  const good=await f.upload(Buffer.from('# 原始材料\n'),'需求.md',{key,clientAttachmentId});assert.equal(good.response.status,201,JSON.stringify(good.body));
  const repeated=await f.upload(Buffer.from('# 原始材料\n'),'需求.md',{key,clientAttachmentId});assert.equal(repeated.response.status,201,JSON.stringify(repeated.body));assert.equal(repeated.body.attachment.attachmentId,good.body.attachment.attachmentId);
  const changed=await f.upload(Buffer.from('不同字节'),'需求.md',{key,clientAttachmentId});assert.equal(changed.response.status,409);
  for(const [bytes,name,status] of [[Buffer.alloc(0),'空.txt',422],[Buffer.from([0xc3,0x28]),'编码.txt',422],[Buffer.alloc(2*1024*1024+1,97),'过大.txt',413],[Buffer.from('x'),'../越界.md',422]]){
    const invalid=await f.upload(bytes,name);assert.equal(invalid.response.status,status,`${name}: ${JSON.stringify(invalid.body)}`);
  }
  const id=good.body.attachment.attachmentId,stillReady=await f.call(`/attachments/${id}`);assert.equal(stillReady.body.state,'READY');
  const hidden=await f.call(`/attachments/${id}`,{headers:{authorization:'Bearer test_other'}});assert.equal(hidden.response.status,404);
  const foreignCreate=await f.call('/projects',{method:'POST',headers:{authorization:'Bearer test_other','content-type':'application/json','idempotency-key':randomUUID()},body:JSON.stringify({initialRequest:{text:'引用别人的附件',attachmentIds:[id]},clientDraftId:randomUUID()})});assert.equal(foreignCreate.response.status,404);
  const boundCreate=await f.create({initialRequest:{text:'引用自己的附件',attachmentIds:[id]}},randomUUID());assert.equal(boundCreate.response.status,201);
  const bound=await f.call(`/attachments/${id}`,{method:'DELETE'});assert.equal(bound.response.status,409);
  const foreign=await f.create({initialRequest:{text:'',attachmentIds:['attachment_does_not_exist']}});assert.equal(foreign.response.status,404);
  const attachmentOnly=await f.upload(Buffer.from('仅材料'),'独立.txt');const created=await f.create({initialRequest:{text:'',attachmentIds:[attachmentOnly.body.attachment.attachmentId]}});assert.equal(created.response.status,201,JSON.stringify(created.body));
  const snapshot=await f.call(`/projects/${created.body.result.projectId}/workspace`);assert.equal(snapshot.body.messages[0].text,'');assert.equal(snapshot.body.messages[0].attachmentIds.length,1);
  const downloaded=await fetch(f.origin+`/api/v1/attachments/${id}/content`,{headers:{authorization:'Bearer test_owner'}});assert.equal(downloaded.status,200);assert.equal(await downloaded.text(),'# 原始材料\n');
});

test('exact attachment limit is accepted and a disconnected upload does not replace another success',{timeout:240000},async t=>{
  const f=await inputFixture(t),maximum=await f.upload(Buffer.alloc(2*1024*1024,97),'边界.txt');assert.equal(maximum.response.status,201,JSON.stringify(maximum.body));assert.equal(maximum.body.attachment.byteSize,2*1024*1024);
  const key=randomUUID(),boundary='devmesh-bounded-partial';
  const request=httpRequest(f.origin+'/api/v1/attachments',{method:'POST',headers:{authorization:'Bearer test_owner','content-type':`multipart/form-data; boundary=${boundary}`,'idempotency-key':key}});request.on('error',()=>{});
  request.write(`--${boundary}\r\nContent-Disposition: form-data; name="clientAttachmentId"\r\n\r\n${randomUUID()}\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="partial.txt"\r\nContent-Type: text/plain\r\n\r\npartial`);
  const deadline=Date.now()+60000;
  try{
    while(true){const original=await f.call(`/operations/lookup?scope=uploads&key=${key}`);if(original.response.status===200){assert.equal(original.body.status,'RUNNING');break;}if(Date.now()>deadline)assert.fail('Upload intake was not persisted before disconnect');await new Promise(resolve=>setTimeout(resolve,25));}
  }finally{request.destroy();}
  while(true){const original=await f.call(`/operations/lookup?scope=uploads&key=${key}`);if(original.body.status==='FAILED'){assert.equal(original.body.result.errorCode,'UPLOAD_INTERRUPTED');break;}if(Date.now()>deadline)assert.fail('Disconnected upload did not reach a durable failure');await new Promise(resolve=>setTimeout(resolve,25));}
  const stillReady=await f.call(`/attachments/${maximum.body.attachment.attachmentId}`);assert.equal(stillReady.body.state,'READY');assert.equal((await f.storage.request('inspect',{})).counts.attachments,1);
});

test('a destroyed creation response recovers the same committed project by original key',{timeout:240000},async t=>{
  const f=await inputFixture(t),key=randomUUID(),body={initialRequest:{text:'销毁回复后仍应找回',attachmentIds:[]},clientDraftId:randomUUID()};
  const bytes=Buffer.from(JSON.stringify(body));
  await new Promise((resolve,reject)=>{const request=httpRequest(f.origin+'/api/v1/projects',{method:'POST',headers:{authorization:'Bearer test_owner','content-type':'application/json','content-length':bytes.length,'idempotency-key':key}},response=>{response.destroy();resolve();});request.once('error',reject);request.end(bytes);});
  const lookup=await f.call(`/operations/lookup?scope=projects.create&key=${key}`);assert.equal(lookup.response.status,200);assert.equal(lookup.body.status,'SUCCEEDED');
  const replay=await f.create(body,key);assert.equal(replay.body.operationId,lookup.body.operationId);
  assert.equal((await f.storage.request('inspect',{})).counts.projects,1);
});
