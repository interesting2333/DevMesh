import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {inputFixture} from './fixtures/input-data.mjs';
const rename=(f,p,name,previousName,key=randomUUID(),headers={})=>f.call('/projects/'+p.projectId+'/name',{method:'PUT',headers:{'content-type':'application/json','idempotency-key':key,...headers},body:JSON.stringify({name,previousName})});

test('project rename is durable and idempotent without changing Run or task basis; receipt rechecks membership',async t=>{
 const f=await inputFixture(t),p=(await f.create({name:'默认名称'})).body.result,key=randomUUID();
 const before=(await f.call('/projects/'+p.projectId+'/workspace')).body;
 const changed=await rename(f,p,'项目新名称','默认名称',key);assert.equal(changed.response.status,200,JSON.stringify(changed.body));assert.equal(changed.body.result.name,'项目新名称');
 const replay=await rename(f,p,'项目新名称','默认名称',key);assert.deepEqual(replay.body,changed.body);
 const after=(await f.call('/projects/'+p.projectId+'/workspace')).body;assert.equal(after.project.name,'项目新名称');assert.equal(after.project.revision,before.project.revision);assert.deepEqual(after.run,before.run);assert.deepEqual(after.messages,before.messages);
 assert.equal((await rename(f,p,'替换请求','默认名称',key)).response.status,409);
 assert.equal(f.sql("SELECT count(*) n FROM operations WHERE kind='RenameInputProject'")[0].n,1);
 const lookup=await f.call('/operations/lookup?scope='+p.projectId+'&key='+key);assert.equal(lookup.body.result.name,'项目新名称');
 f.sql('DELETE FROM project_members WHERE project_id=? AND principal_id=?',p.projectId,'user_1');assert.equal((await rename(f,p,'项目新名称','默认名称',key)).response.status,404);
});

test('concurrent names compare the previous name, roll back rejected edits and deny viewer or foreign writes',async t=>{
 const f=await inputFixture(t),p=(await f.create({name:'原名称'})).body.result;
 const attempts=await Promise.all([rename(f,p,'甲','原名称'),rename(f,p,'乙','原名称')]);assert.deepEqual(attempts.map(r=>r.response.status).sort(),[200,409]);
 assert.equal(f.sql("SELECT count(*) n FROM operations WHERE kind='RenameInputProject'")[0].n,1);
 const current=(await f.call('/projects/'+p.projectId+'/workspace')).body.project.name;
 f.sql('INSERT INTO project_members VALUES(?,?,?,?)',p.projectId,'viewer_1','viewer',new Date().toISOString());
 assert.equal((await rename(f,p,'越权',current,randomUUID(),{authorization:'Bearer test_viewer'})).response.status,403);
 assert.equal((await rename(f,p,'外人',current,randomUUID(),{authorization:'Bearer test_other'})).response.status,404);
 assert.equal((await rename(f,p,'错误页面',current,randomUUID(),{'x-devmesh-principal':'user_2'})).response.status,403);
 for(const bad of ['',' '.repeat(3),'名'.repeat(81)])assert.equal((await rename(f,p,bad,current)).response.status,422);
 assert.equal((await f.call('/projects/'+p.projectId+'/workspace')).body.project.name,current);
});
