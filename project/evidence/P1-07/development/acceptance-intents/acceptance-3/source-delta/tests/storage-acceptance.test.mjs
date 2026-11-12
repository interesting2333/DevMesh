import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {applyMigrations,readMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {createDomain} from '../packages/storage-sqlite/dist/domain.mjs';
import {fixture,project} from './fixtures/storage-data.mjs';
test('version 36 acceptance tables and markers roll back together and preserve version 35 state through actual retry',async t=>{
  const f=await fixture(t,{targetVersion:35});await f.storage.close();const db=new DatabaseSync(f.options.databasePath);db.exec('PRAGMA foreign_keys=ON');
  try{
    const domain=createDomain(db);await project({async request(method,input){return domain.execute(method,input);}},f.root);
    const rows=db.prepare('SELECT * FROM runs').all(),history=db.prepare('SELECT * FROM schema_migrations').all(),migrations=readMigrations(),bad=[...migrations.slice(0,35),{...migrations[35],sql:migrations[35].sql+'\nSELECT * FROM injected_acceptance_migration_failure;'}];
    assert.throws(()=>applyMigrations(db,bad,f.options.storeId),/injected_acceptance_migration_failure/);assert.equal(db.prepare('PRAGMA user_version').get().user_version,35);assert.deepEqual(db.prepare('SELECT * FROM schema_migrations').all(),history);assert.deepEqual(db.prepare('SELECT * FROM runs').all(),rows);
    for(const name of ['acceptance_backend_policies','acceptance_data_decisions','acceptance_preparations','acceptance_preparation_history'])assert.equal(db.prepare('SELECT name FROM sqlite_master WHERE name=?').get(name),undefined);
    assert.equal(applyMigrations(db,migrations,f.options.storeId),36);assert.deepEqual(db.prepare('SELECT * FROM runs').all(),rows);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.equal(db.prepare('SELECT count(*) n FROM preview_sessions').get().n,0);
  }finally{db.close();}
});
