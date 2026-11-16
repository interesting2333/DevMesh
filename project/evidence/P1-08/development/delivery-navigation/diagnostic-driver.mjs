import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {workbenchDeliveryFixture} from '../tests/fixtures/workbench-delivery.mjs';import {meta} from '../tests/fixtures/storage-data.mjs';
test('diagnose original workspace content fixture, not a product pass',{timeout:240000},async t=>{
 const f=await workbenchDeliveryFixture(t),path='/api/v1/projects/'+f.p.projectId+'/workspace?runId='+f.p.runId,first=await f.get(path),before={status:first.status,body:await first.json()};let directRead;
 try{directRead={text:await f.content.readText('user_1',{kind:'artifact',artifactId:f.p.artifactId},256*1024)};}catch(error){directRead={code:error.code,message:error.message};}
 const written=await f.content.putBytes(meta(),{kind:'content'},Buffer.from('用户需求原文'),'text/plain; charset=utf-8'),second=await f.get(path),after={status:second.status,body:await second.json()},record={at:new Date().toISOString(),before,directRead,written,after,scope:'Diagnostic reproduction only; not counted as a delivery product scenario.'};fs.writeFileSync('.cache/p154-evidence/fixture-probe.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({before,directRead,afterStatus:after.status}));assert.equal(after.status,200,JSON.stringify(after.body));
});
