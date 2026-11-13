import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {openRunnerStore} from '../packages/runner/dist/index.mjs';

test('Runner v1 upgrades transactionally to v7 without changing original jobs and rejects a changed v2 migration fingerprint',async t=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/runner-v1.json',import.meta.url),'utf8')),root=await mkdtemp(join(tmpdir(),'devmesh-runner-upgrade-')),databasePath=join(root,'runner.sqlite'),db=new DatabaseSync(databasePath);
  assert.equal(fixture.userVersion,1);
  try{db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;');for(const item of fixture.schema)db.exec(item.sql);for(const [table,rows] of Object.entries(fixture.rows)){assert.ok(['runner_identity','jobs','job_events'].includes(table));for(const row of rows){const keys=Object.keys(row);db.prepare('INSERT INTO '+table+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));}}db.exec('PRAGMA user_version=1; COMMIT;');}finally{db.close();}
  const options={databasePath,runnerId:'runner.test'},original=fixture.rows.jobs[0],store=await openRunnerStore(options);t.after(()=>store.close());
  assert.equal((await store.request('inspect',{})).version,12);const recovered=await store.request('byOperation',{controllerId:original.controller_id,operationId:original.operation_id});assert.equal(recovered.jobId,original.job_id);assert.equal(recovered.requestHash,original.request_hash);assert.deepEqual(recovered.request,JSON.parse(original.request_json));assert.equal(recovered.state,'QUEUED');assert.equal(recovered.containerId,null);assert.deepEqual((await store.request('inspect',{})).foreignKeyErrors,[]);await store.close();
  const reopened=await openRunnerStore(options);await reopened.close();const corrupt=new DatabaseSync(databasePath);try{corrupt.prepare('UPDATE runner_schema_history SET sha256=? WHERE version=2').run('f'.repeat(64));}finally{corrupt.close();}
  await assert.rejects(openRunnerStore(options),{code:'RUNNER_MIGRATION_DRIFT'});t.diagnostic('Retained dedicated upgrade evidence: '+root);
});
