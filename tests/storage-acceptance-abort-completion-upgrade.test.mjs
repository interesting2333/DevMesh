import test from 'node:test';
import assert from 'node:assert/strict';
import {readMigrations,applyMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {sourceCompletionFixture} from './fixtures/acceptance-abort-completion.mjs';
test('v40 unresolved abort, closed source and UNKNOWN write survive v41; failures restore exact old schema',async t=>{
 const f=await sourceCompletionFixture(t,{targetVersion:40,unresolvedWrite:true}),m=readMigrations(),id=f.get('SELECT store_id FROM store_metadata').store_id;
 const snapshot=()=>f.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]),schema=()=>f.db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all(),before=snapshot(),ddl=schema();
 for(const kind of ['ddl','history']){
  if(kind==='history')f.db.exec("CREATE TRIGGER explicit_v41_cut BEFORE INSERT ON schema_migrations WHEN NEW.version=41 BEGIN SELECT RAISE(ABORT,'EXPLICIT_V41_CUT'); END");
  const selected=kind==='ddl'?[...m.slice(0,40),{...m[40],sql:m[40].sql+'\nSELECT * FROM explicit_v41_cut;'}]:m;assert.throws(()=>applyMigrations(f.db,selected,id),/explicit_v41_cut/i);assert.equal(f.get('PRAGMA user_version').user_version,40);assert.equal(f.get('PRAGMA foreign_keys').foreign_keys,1);assert.deepEqual(snapshot(),before);if(kind==='history')f.db.exec('DROP TRIGGER explicit_v41_cut');assert.deepEqual(schema(),ddl);
 }
  assert.equal(applyMigrations(f.db,m,id,1,41),41);for(const [name,rows] of before)if(name!=='schema_migrations')assert.deepEqual(f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),rows,name);assert.equal(f.get('SELECT count(*) n FROM acceptance_abort_completions').n,0);assert.equal(f.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',f.d.datasetId).state,'CLOSED');assert.equal(f.get("SELECT count(*) n FROM preview_access_requests WHERE state='UNKNOWN'").n,1);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
 assert.throws(()=>f.run("UPDATE preview_write_gates SET state='OPEN',fence=fence+1,revision=revision+1,close_operation_id=NULL,close_request_hash=NULL WHERE dataset_id=?",f.d.datasetId),/PREVIEW_WRITE_GATE_IMMUTABLE/);
});
