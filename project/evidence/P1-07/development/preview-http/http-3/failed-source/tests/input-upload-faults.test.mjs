import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('a real staging path failure terminates the original intake instead of leaving it receiving',{timeout:240000},async t=>{
  const f=await inputFixture(t),key=randomUUID();
  rmdirSync(join(f.local.dataRoot,'staging','uploads'));
  writeFileSync(join(f.local.dataRoot,'staging','uploads'),'not a directory');
  const result=await f.upload(Buffer.from('仍应核实失败状态'),'材料.md',{key});assert.equal(result.response.status,503,JSON.stringify(result.body));
  const original=await f.call(`/operations/lookup?scope=uploads&key=${key}`);assert.equal(original.body.status,'FAILED');assert.equal((await f.storage.request('inspect',{})).counts.attachments,0);
});

test('malformed framing and excessive part headers are input errors with durable failed upload facts',{timeout:240000},async t=>{
  const f=await inputFixture(t),boundary='devmesh-malformed-headers';
  for(const body of ['not a multipart frame',`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nX-Padding: ${'x'.repeat(17000)}\r\n\r\na\r\n--${boundary}--\r\n`]){
    const key=randomUUID(),result=await f.call('/attachments',{method:'POST',headers:{'content-type':`multipart/form-data; boundary=${boundary}`,'idempotency-key':key},body});
    assert.equal(result.response.status,422,JSON.stringify(result.body));assert.equal(result.body.error.code,'MULTIPART_INVALID');
    const original=await f.call(`/operations/lookup?scope=uploads&key=${key}`);assert.equal(original.body.status,'FAILED');
  }
  assert.equal((await f.storage.request('inspect',{})).counts.attachments,0);
});

test('a failed final intake acknowledgement preserves published attachment facts for exact recovery',{timeout:240000},async t=>{
  const f=await inputFixture(t),key=randomUUID();
  f.sql("CREATE TRIGGER test_upload_finalize BEFORE UPDATE OF state ON upload_intakes WHEN NEW.state='READY' BEGIN SELECT RAISE(ABORT,'TEST_FINALIZE_FAILURE'); END");
  const result=await f.upload(Buffer.from('已经发布的真实材料'),'恢复.md',{key});assert.equal(result.response.status,503,JSON.stringify(result.body));
  const original=await f.storage.request('lookupInputOperation',{principalId:'user_1',scopeId:'uploads',idempotencyKey:key});assert.equal(original.status,'OUTCOME_UNKNOWN');
  assert.equal((await f.storage.request('inspect',{})).counts.attachments,1);
  f.sql('DROP TRIGGER test_upload_finalize');await f.local.close();await f.reopen();await f.content.recoverPublished();await f.storage.request('recoverUploadIntakes',{});
  const recovered=await f.storage.request('lookupInputOperation',{principalId:'user_1',scopeId:'uploads',idempotencyKey:key});assert.equal(recovered.status,'SUCCEEDED');
  const attachment=await f.storage.request('getInputAttachment',{principalId:'user_1',attachmentId:recovered.result.attachmentId});assert.equal(attachment.state,'READY');assert.equal((await f.storage.request('inspect',{})).counts.attachments,1);
});
