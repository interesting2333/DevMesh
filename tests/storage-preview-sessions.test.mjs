import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readMigrations,applyMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {createDomain} from '../packages/storage-sqlite/dist/domain.mjs';
import {fixture,project,hash} from './fixtures/storage-data.mjs';
test('version 35 credential tables and generated target keys roll back atomically without changing version 34 policy or application history',async t=>{
 const f=await fixture(t,{targetVersion:34});await f.storage.close();
 const db=new DatabaseSync(f.options.databasePath);db.exec('PRAGMA foreign_keys=ON');
 try{
  const domain=createDomain(db),p=await project({async request(method,input){return domain.execute(method,input);}},f.root);
  domain.execute('registerPreviewAccessPolicy',{principalId:'user_1',projectId:p.projectId,policy:{schemaVersion:'devmesh.preview-access-policy.v1',gatewayId:'preview.historical.gateway',gatewayPrincipalId:'preview.historical.service',configurationHash:hash('original v34 configuration')}});
  const original={runs:db.prepare('SELECT * FROM runs').all(),policies:db.prepare('SELECT * FROM preview_access_policies').all()},migrations=readMigrations(),bad=[...migrations.slice(0,34),{...migrations[34],sql:migrations[34].sql+'\nSELECT * FROM injected_credential_migration_failure;'}];
  assert.throws(()=>applyMigrations(db,bad,f.options.storeId),/injected_credential_migration_failure/);
  assert.equal(db.prepare('PRAGMA user_version').get().user_version,34);assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n,34);
  for(const name of ['preview_tickets','preview_sessions','preview_credential_events','preview_credential_target_binding','preview_policy_credential_binding'])assert.equal(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name),undefined);
  assert.deepEqual(db.prepare('SELECT * FROM runs').all(),original.runs);assert.deepEqual(db.prepare('SELECT * FROM preview_access_policies').all(),original.policies);
  assert.equal(applyMigrations(db,migrations.slice(0,35),f.options.storeId),35);
  assert.equal(db.prepare('SELECT count(*) n FROM preview_sessions').get().n,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.deepEqual(db.prepare('SELECT * FROM runs').all(),original.runs);assert.deepEqual(db.prepare('SELECT * FROM preview_access_policies').all(),original.policies);
 }finally{db.close();}
});
