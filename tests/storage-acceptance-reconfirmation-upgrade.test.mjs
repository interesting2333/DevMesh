import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readMigrations,applyMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {candidateFixture} from './fixtures/candidate-data.mjs';
import {hash} from './fixtures/storage-data.mjs';

test('v44 replacement confirmation upgrades byte-for-byte to append-only history; migration failure leaves all original facts intact',async t=>{
 // Historical approval and Release are explicit migrated-row fixtures, not T5.
 const f=await candidateFixture(t,{targetVersion:44}),op=f.get("SELECT operation_id FROM decisions WHERE run_id=? AND subject_kind='PLAN'",f.p.runId).operation_id,at=new Date().toISOString();
 f.insert('release_candidates',{candidate_id:'candidate_legacy_confirmation',project_id:f.p.projectId,run_id:f.p.runId,revision:1,code_commit:'b'.repeat(40),requirement_revision:1,plan_revision:1,manifest_hash:hash('legacy manifest'),check_config_hash:hash('legacy config'),data_plan_hash:hash('legacy plan'),manifest_json:'{}',state:'READY'});
 f.insert('releases',{release_id:'release_legacy_confirmation',project_id:f.p.projectId,run_id:f.p.runId,candidate_id:'candidate_legacy_confirmation',candidate_revision:1,acceptance_operation_id:op,manifest_hash:hash('legacy manifest'),prepared_data_ref:'explicit-legacy-row-only',accepted_by:'user_1',accepted_at:at});
 const original={decision_id:'decision_legacy_confirmation',operation_id:op,project_id:f.p.projectId,run_id:f.p.runId,candidate_id:'candidate_legacy_confirmation',manifest_hash:hash('legacy manifest'),review_hash:hash('legacy review'),source_release_id:'release_legacy_confirmation',data_plan_hash:hash('legacy plan'),actor_id:'user_1',created_at:at};f.insert('acceptance_data_decisions',original);
 const old={...f.get('SELECT * FROM acceptance_data_decisions')},migrations=readMigrations(),storeId=f.get('SELECT store_id FROM store_metadata').store_id;
 for(const cut of [migrations[44].sql.replace('INSERT INTO acceptance_data_confirmations SELECT * FROM acceptance_data_decisions;','SELECT * FROM confirmation_copy_cut;'),migrations[44].sql+'\nSELECT * FROM confirmation_final_cut;']){
  assert.throws(()=>applyMigrations(f.db,[...migrations.slice(0,44),{...migrations[44],sql:cut}],storeId),/confirmation_(?:copy|final)_cut/);assert.equal(f.get('PRAGMA user_version').user_version,44);assert.equal(f.get("SELECT name FROM sqlite_master WHERE name='acceptance_data_confirmations'"),undefined);assert.deepEqual({...f.get('SELECT * FROM acceptance_data_decisions')},old);assert.equal(f.get('SELECT count(*) n FROM schema_migrations').n,44);assert.equal(f.get('PRAGMA foreign_keys').foreign_keys,1);
 }
 assert.equal(applyMigrations(f.db,migrations,storeId),45);assert.deepEqual({...f.get('SELECT * FROM acceptance_data_decisions')},old);assert.deepEqual({...f.get('SELECT * FROM acceptance_data_confirmations')},old);assert.equal(applyMigrations(f.db,migrations,storeId),45);
 assert.throws(()=>f.run('UPDATE acceptance_data_confirmations SET review_hash=?',hash('rewrite')),/ACCEPTANCE_CONFIRMATION_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM acceptance_data_confirmations'),/ACCEPTANCE_CONFIRMATION_IMMUTABLE/);
 const nextOp='op_'+randomUUID().replaceAll('-','');f.run('INSERT INTO operations VALUES(?,?,?,?,?,?,?,?,?,?)',nextOp,'user_1',f.p.runId,randomUUID(),hash(nextOp),'explicit-upgrade-row-test','SUCCEEDED',null,at,at);
 const next={...original,operation_id:nextOp,review_hash:hash('new review')};assert.throws(()=>f.insert('acceptance_data_confirmations',{...next,data_plan_hash:hash('different plan')}),/ACCEPTANCE_CONFIRMATION_BASIS_CHANGED/);assert.throws(()=>f.insert('acceptance_data_confirmations',{...next,manifest_hash:hash('different candidate')}),/ACCEPTANCE_CONFIRMATION_BASIS_CHANGED/);f.insert('acceptance_data_confirmations',next);assert.equal(f.get('SELECT count(*) n FROM acceptance_data_confirmations').n,2);assert.deepEqual({...f.get('SELECT * FROM acceptance_data_decisions')},old);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
