import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';

test('input transport rejects ambiguous headers, wrong host and unsupported cookie identity',{timeout:240000},async t=>{
  const f=await inputFixture(t);
  const cookie=await f.call('/projects',{headers:{cookie:'devmesh_session=untrusted'}});assert.equal(cookie.response.status,401);
  // Fetch normalizes the forbidden Host header; use a real HTTP request to put
  // the attacker-controlled value on the wire.
  const host=await new Promise((resolve,reject)=>{const request=httpRequest(f.origin+'/api/v1/projects',{headers:{host:'attacker.invalid',authorization:'Bearer test_owner'}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));});request.once('error',reject);request.end();});assert.equal(host,403);
  const duplicate=await new Promise((resolve,reject)=>{
    const request=httpRequest(f.origin+'/api/v1/projects',{headers:['Host',new URL(f.origin).host,'Authorization','Bearer test_owner','Authorization','Bearer test_other']},response=>{let text='';response.on('data',bytes=>{text+=bytes;});response.on('end',()=>resolve({status:response.statusCode,body:JSON.parse(text)}));});request.once('error',reject);request.end();
  });
  assert.equal(duplicate.status,400);assert.equal(duplicate.body.error.code,'REQUEST_HEADERS_INVALID');assert.equal((await f.storage.request('inspect',{})).counts.projects,0);
  const disabled=await inputFixture(t,{enabled:false});const result=await disabled.call('/projects');assert.equal(result.response.status,404);assert.equal(disabled.api.enabled,false);
});

test('shutdown aborts pending trusted identity resolution and admits no late project write',{timeout:240000},async t=>{
  let startedResolve,identityResolve,signal;
  const started=new Promise(resolve=>{startedResolve=resolve;}),identity=new Promise(resolve=>{identityResolve=resolve;});
  const f=await inputFixture(t,{identityResolver:(_request,context)=>{signal=context.signal;startedResolve();return identity;}});
  const pending=f.create({clientDraftId:randomUUID()});await started;
  await f.api.stop();assert.equal(signal.aborted,true);identityResolve({principalId:'user_1'});
  const result=await pending;assert.equal(result.response.status,503);assert.equal(result.body.error.code,'SERVICE_STOPPING');assert.equal((await f.storage.request('inspect',{})).counts.projects,0);
});
