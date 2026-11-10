import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync,readFileSync,existsSync,unlinkSync,readdirSync,symlinkSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { openLocalStorage,resolveStorageConfig,safePath } from '../packages/blob-store/dist/index.mjs';
import { contentFixture,createSession,messageTarget,digest,meta } from './fixtures/content-data.mjs';
const rejects=(promise,code)=>assert.rejects(promise,e=>e.code===code,'Expected error '+code);

test('layout is explicit, durable, identity checked and exclusively locked',async t=>{
  const f=await contentFixture(t),info=await f.storage.request('inspect',{});
  assert.equal(info.storeId,f.local.marker.storeId);assert.equal(info.version,4);assert.equal(Object.keys(info.counts).length,39);
  assert.ok(['supported','unsupported'].includes(f.local.directorySync));
  await rejects(openLocalStorage(f.options),'STORAGE_LOCKED');
  const id=f.local.marker.storeId;await f.local.close();
  await rejects(openLocalStorage({...f.options,storeId:randomUUID()}),'STORE_IDENTITY_MISMATCH');
  await f.reopen();assert.equal(f.local.marker.storeId,id);
  await rejects(openLocalStorage({...f.options,dataRoot:join(f.root,'never-created')}),'STORAGE_NOT_INITIALIZED');
  assert.equal(existsSync(join(f.root,'never-created')),false);
});

test('unknown directories, nested roots, links and unsafe logical keys are rejected',async t=>{
  const f=await contentFixture(t),unknown=join(f.root,'unknown');mkdirSync(unknown);writeFileSync(join(unknown,'important.txt'),'keep');
  await rejects(openLocalStorage({...f.options,dataRoot:unknown,initialize:true}),'LAYOUT_UNRECOGNIZED');
  assert.equal(readFileSync(join(unknown,'important.txt'),'utf8'),'keep');
  await rejects(openLocalStorage({...f.options,backupRoot:join(f.local.dataRoot,'backup')}),'STORAGE_ROOTS_OVERLAP');
  for(const key of ['../escape','sha256/../../escape','/absolute','C:/x','a\\b','CON.txt','x/..','x/file.'])assert.throws(()=>safePath(join(f.local.dataRoot,'artifacts'),key),e=>e.code==='STORAGE_KEY_INVALID');
  const outside=join(f.root,'outside'),linked=join(f.root,'linked');mkdirSync(outside);symlinkSync(outside,linked,process.platform==='win32'?'junction':'dir');
  await rejects(openLocalStorage({...f.options,dataRoot:linked,initialize:true}),'ROOT_LINK_INVALID');
});

test('storage paths anchor to the configuration file and environment has explicit precedence',()=>{
  const base=process.platform==='win32'?'D:/settings/app.json':'/opt/settings/app.json';
  const config=resolveStorageConfig({dataRoot:'control',backupRoot:'backup'},base,{});
  assert.equal(config.dataRoot,join(process.platform==='win32'?'D:/settings':'/opt/settings','control'));
  assert.throws(()=>resolveStorageConfig({dataRoot:'relative',backupRoot:'backup',mode:'shared'},base,{}),e=>e.code==='ROOT_PATH_INVALID');
  const data=process.platform==='win32'?'D:/override/control':'/override/control';
  assert.equal(resolveStorageConfig({dataRoot:'control',backupRoot:'backup'},base,{DEVMESH_DATA_ROOT:data}).dataRoot,join(data));
});

test('attachments exist before any Run and content deduplication grants no cross-principal access',async t=>{
  const f=await contentFixture(t),target={kind:'attachment',name:'../../CON.txt',clientAttachmentId:randomUUID()},m=meta();
  const first=await f.content.putText(m,target,'共享字节 😀');
  assert.deepEqual(await f.content.putText(m,target,'共享字节 😀'),first);
  await rejects(f.content.putText(m,target,'different'),'IDEMPOTENCY_KEY_REUSED');
  const id=first.result.attachmentId;
  assert.equal(await f.content.readText('user_1',{kind:'attachment',attachmentId:id}),'共享字节 😀');
  await rejects(f.content.readText('user_2',{kind:'attachment',attachmentId:id}),'FORBIDDEN');
  const second=await f.content.putText({...meta(),principalId:'user_2'},{...target,clientAttachmentId:randomUUID()},'共享字节 😀');
  assert.equal(second.expectedHash,first.expectedHash);assert.notEqual(second.result.attachmentId,id);
  const info=await f.storage.request('inspect',{});assert.equal(info.counts.runs,0);assert.equal(info.counts.attachments,2);assert.equal(info.counts.content_objects,1);
  await rejects(f.storage.request('resolveContentRead',{principalId:'user_1',reference:{kind:'hash',contentHash:first.expectedHash}}),'SCHEMA_INVALID');
});

test('concurrent duplicate writes and equal-content publications remain unique and immutable',async t=>{
  const f=await contentFixture(t),m=meta(),target={kind:'attachment',name:'same.txt',clientAttachmentId:randomUUID()};
  const [a,b]=await Promise.all([f.content.putText(m,target,'same'),f.content.putText(m,target,'same')]);assert.deepEqual(a,b);
  const [c,d]=await Promise.all([f.content.putText(meta(),{...target,clientAttachmentId:randomUUID()},'other'),f.content.putText(meta(),{...target,clientAttachmentId:randomUUID()},'other')]);
  assert.equal(c.expectedHash,d.expectedHash);
  const info=await f.storage.request('inspect',{});assert.equal(info.counts.object_write_operations,3);assert.equal(info.counts.content_objects,2);assert.equal(info.counts.attachments,3);
  assert.deepEqual(readdirSync(join(f.local.dataRoot,'staging/objects')),[]);
});

test('partial or oversized streams create no READY reference and original key can receive the bytes again',async t=>{
  const f=await contentFixture(t),bytes=Buffer.from('complete body'),input={meta:meta(),target:{kind:'attachment',name:'retry.txt',clientAttachmentId:randomUUID()},expectedHash:digest(bytes),expectedSize:bytes.length,mimeType:'text/plain'};
  async function* partial(){yield bytes.subarray(0,2);throw new Error('transport interrupted');}
  await assert.rejects(f.content.put(input,partial()),/transport interrupted/);
  let info=await f.storage.request('inspect',{});assert.equal(info.counts.attachments,0);assert.equal(info.counts.content_objects,0);
  const first=await f.content.put(input,bytes);assert.equal(first.state,'REGISTERED');
  const tooLong={...input,meta:meta(),expectedSize:1,target:{...input.target,clientAttachmentId:randomUUID()}};
  await rejects(f.content.put(tooLong,bytes),'CONTENT_SIZE_MISMATCH');
  info=await f.storage.request('inspect',{});assert.equal(info.counts.attachments,1);
});

test('session identity, message order, idempotency and restart use committed indexes',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f);
  assert.equal((await f.sessions.ensure('user_1',ctx.runId,ctx.attemptId)).sessionId,ctx.sessionId);
  await rejects(f.sessions.ensure('user_2',ctx.runId,ctx.attemptId),'FORBIDDEN');
  const m=meta(ctx.sessionId),target=messageTarget(ctx);
  const first=await f.sessions.append(m,target,'第一条 😀');
  await f.sessions.append(meta(ctx.sessionId),messageTarget(ctx,'second'),'第二条');
  assert.deepEqual(await f.sessions.append(m,target,'第一条 😀'),first);
  const before=await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId,limit:1});assert.equal(before.nextCursor,1);
  await f.local.close();await f.reopen();
  const after=await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId,afterSeq:1});assert.deepEqual(after.messages.map(m=>m.seq),[2]);
  assert.equal(await f.content.readText('user_1',{kind:'message',messageId:first.result.messageId}),'第一条 😀');
  await rejects(f.storage.request('listSessionMessages',{principalId:'user_2',sessionId:ctx.sessionId}),'FORBIDDEN');
});

test('model requests and complete responses are persisted before tool messages, with unknown sent steps retained',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f),configHash='a'.repeat(64);
  await f.sessions.append(meta(),messageTarget(ctx),'目标');
  const snapshot=await f.sessions.snapshot(meta(),ctx.sessionId,configHash);
  const target={kind:'modelRequest',sessionId:ctx.sessionId,stepNo:1,contextSnapshotId:snapshot.result.contextSnapshotId,configHash};
  await f.sessions.saveRequest(meta(),target,{messages:[{role:'user',content:'目标'}]});
  await f.storage.request('markModelStepSent',{principalId:'user_1',sessionId:ctx.sessionId,stepNo:1});
  const tool={...messageTarget(ctx,'tool.1'),messageKind:'tool-call',stepNo:1,toolCallId:'call_1'};
  await rejects(f.sessions.append(meta(),tool,'{"path":"src/a.ts"}'),'MODEL_RESPONSE_REQUIRED');
  await f.local.close();await f.reopen();
  assert.equal((await f.storage.request('getModelStep',{principalId:'user_1',sessionId:ctx.sessionId,stepNo:1})).state,'SENT');
  await rejects(f.sessions.saveRequest(meta(),{...target,stepNo:2},{messages:[]}),'MODEL_STEP_ORDER_INVALID');
  const response=await f.sessions.saveResponse(meta(),{kind:'modelResponse',sessionId:ctx.sessionId,stepNo:1,activationId:ctx.activationId,state:'RESPONDED',providerRequestId:'request_1',usage:{inputTokens:10,outputTokens:5,source:'provider'}},{text:'调用工具',toolCalls:[{id:'call_1',name:'read-file',arguments:{path:'src/a.ts'}}]});
  assert.equal(response.result.state,'RESPONDED');
  await f.sessions.append(meta(),tool,'{"path":"src/a.ts"}');
  const step=await f.storage.request('getModelStep',{principalId:'user_1',sessionId:ctx.sessionId,stepNo:1});assert.equal(step.responseHash,response.expectedHash);
  await rejects(f.sessions.saveResponse(meta(),{kind:'modelResponse',sessionId:ctx.sessionId,stepNo:1,activationId:ctx.activationId,state:'FAILED'},{text:'overwrite'}),'MODEL_RESPONSE_IMMUTABLE');
  await rejects(f.sessions.saveRequest(meta(),{...target,stepNo:2},{authorization:'secret'}),'PRIVATE_MODEL_FIELD');
});

test('context hash, session role and ordered source messages cannot be forged',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f);
  const first=await f.sessions.append(meta(),messageTarget(ctx),'一'),second=await f.sessions.append(meta(),messageTarget(ctx,'two'),'二');
  const snapshot=await f.sessions.snapshot(meta(),ctx.sessionId,'a'.repeat(64));
  const manifest=JSON.parse(await f.content.readText('user_1',{kind:'context',contextSnapshotId:snapshot.result.contextSnapshotId}));
  assert.deepEqual(manifest.messages.map(m=>m.messageId),[first.result.messageId,second.result.messageId]);
  const reordered={...manifest,messages:[...manifest.messages].reverse()};
  await rejects(f.content.putJson(meta(),{kind:'context',manifest:reordered},reordered),'CONTEXT_BASIS_CHANGED');
  const omitted={...manifest,messages:manifest.messages.slice(1)};
  await rejects(f.content.putJson(meta(),{kind:'context',manifest:omitted},omitted),'CONTEXT_MESSAGES_MISSING');
  const foreign={...manifest,roleSnapshotId:'role_foreign'};
  await rejects(f.content.putJson(meta(),{kind:'context',manifest:foreign},foreign),'CONTEXT_BASIS_CHANGED');
});

test('edited or deleted JSONL projections are rebuilt without altering history',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f);
  await f.sessions.append(meta(),messageTarget(ctx),'原始正文\n第二行');
  const first=await f.sessions.exportJsonl('user_1',ctx.sessionId);
  const original=readFileSync(first.transcriptPath,'utf8');assert.equal(digest(original),first.sha256);
  writeFileSync(first.transcriptPath,'edited');
  const second=await f.sessions.exportJsonl('user_1',ctx.sessionId);assert.equal(readFileSync(second.transcriptPath,'utf8'),original);
  rmSync(join(f.local.dataRoot,'views/sessions',ctx.sessionId),{recursive:true});
  const third=await f.sessions.exportJsonl('user_1',ctx.sessionId);assert.equal(third.sha256,first.sha256);assert.equal(third.throughMessageSeq,1);
  assert.equal((await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId})).messages.length,1);
});

test('missing or corrupt immutable bytes are reported and marked MISSING, never reconstructed from views',async t=>{
  const f=await contentFixture(t),target={kind:'attachment',name:'lost.txt',clientAttachmentId:randomUUID()},write=await f.content.putText(meta(),target,'original');
  const path=join(f.local.dataRoot,'artifacts/sha256',write.expectedHash.slice(0,2),write.expectedHash);writeFileSync(path,'tampered');
  await rejects(f.content.readText('user_1',{kind:'attachment',attachmentId:write.result.attachmentId}),'CONTENT_CORRUPT');
  const objects=await f.storage.request('listContentObjects',{});assert.equal(objects[0].state,'MISSING');
  unlinkSync(path);
  const report=await f.content.verifyAll();assert.equal(report.failures[0].code,'CONTENT_MISSING');assert.equal(existsSync(path),false);
  await rejects(f.content.readText('user_1',{kind:'attachment',attachmentId:write.result.attachmentId}),'CONTENT_UNAVAILABLE');
});

test('failed index commit leaves published bytes and the original operation can complete exactly once',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f);await f.local.close();
  const dbPath=join(f.options.dataRoot,'db/devmesh.sqlite'),db=new DatabaseSync(dbPath);db.exec("CREATE TRIGGER test_reject_message BEFORE INSERT ON session_messages BEGIN SELECT RAISE(ABORT,'TEST_INDEX_FAILURE'); END;");db.close();
  await f.reopen();const m=meta(),target=messageTarget(ctx),bytes=Buffer.from('body survives rollback');
  await rejects(f.content.putBytes(m,target,bytes,'text/plain'),'STORAGE_CONSTRAINT');
  assert.equal((await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId})).messages.length,0);
  const hash=digest(bytes);assert.ok(existsSync(join(f.options.dataRoot,'artifacts/sha256',hash.slice(0,2),hash)));
  const pending=await f.storage.request('scanObjectWrites',{});assert.equal(pending.at(-1).state,'SEALED');
  await f.local.close();const repair=new DatabaseSync(dbPath);repair.exec('DROP TRIGGER test_reject_message');repair.close();await f.reopen();
  assert.equal((await f.content.recoverPublished()).recovered.length,1);
  const original=await f.content.putBytes(m,target,bytes,'text/plain');assert.equal(original.state,'REGISTERED');
  assert.equal((await f.storage.request('listSessionMessages',{principalId:'user_1',sessionId:ctx.sessionId})).messages.length,1);
});

test('deletion is fenced by business references and read pins; an unreferenced object has no new references while deleting',async t=>{
  const f=await contentFixture(t),a=await f.content.putText(meta(),{kind:'attachment',name:'keep.txt',clientAttachmentId:randomUUID()},'keep');
  const reading=await f.content.openRead('user_1',{kind:'attachment',attachmentId:a.result.attachmentId});
  await rejects(f.content.deleteUnreferenced(a.expectedHash),'CONTENT_REFERENCED');reading.stream.destroy();await reading.release();
  await rejects(f.content.deleteUnreferenced(a.expectedHash),'CONTENT_REFERENCED');
  const orphan=await f.content.putText(meta(),{kind:'content'},'orphan');
  await f.storage.request('beginContentDeletion',{contentHash:orphan.expectedHash});
  await rejects(f.content.putText(meta(),{kind:'attachment',name:'new.txt',clientAttachmentId:randomUUID()},'orphan'),'CONTENT_CONFLICT');
  // Failed reference remains a pending write; finish it as failed before deletion is retried.
  const pending=await f.storage.request('scanObjectWrites',{});for(const write of pending)await f.storage.request('failObjectWrite',{principalId:write.ownerId,writeId:write.writeId,error:'maintenance rejected new reference'});
  await f.content.deleteUnreferenced(orphan.expectedHash);
  assert.equal((await f.storage.request('listContentObjects',{})).some(c=>c.contentHash===orphan.expectedHash),false);
});

test('formal session records reject mutation and invalid cross-run ownership',async t=>{
  const f=await contentFixture(t),ctx=await createSession(f),first=await f.sessions.append(meta(),messageTarget(ctx),'immutable');
  await f.local.close();const db=new DatabaseSync(join(f.options.dataRoot,'db/devmesh.sqlite'));db.exec('PRAGMA foreign_keys=ON');
  try{
    assert.throws(()=>db.prepare('UPDATE session_messages SET body_content_hash=body_content_hash WHERE message_id=?').run(first.result.messageId),/MESSAGE_IMMUTABLE/);
    assert.throws(()=>db.prepare('DELETE FROM session_messages WHERE message_id=?').run(first.result.messageId),/MESSAGE_IMMUTABLE/);
    assert.throws(()=>db.prepare('UPDATE agent_sessions SET run_id=? WHERE session_id=?').run('run_other',ctx.sessionId),/SESSION_IDENTITY_IMMUTABLE/);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
});
