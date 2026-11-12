import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {mkdirSync,readFileSync} from 'node:fs';
import {openStorage} from '../packages/storage-sqlite/dist/index.mjs';
import {readMigrations,applyMigrations,digest} from '../packages/storage-sqlite/dist/migrations.mjs';
import {createDomain} from '../packages/storage-sqlite/dist/domain.mjs';
import {previewAccessFixture} from './fixtures/preview-access.mjs';
import {fixture,project,hash} from './fixtures/storage-data.mjs';
const migrations=readMigrations();
// Production Workers intentionally forbid commands against a partial schema.
// Seed historical application rows through its synchronous domain in isolation.
async function historicalProject(f){await f.storage.close();const db=new DatabaseSync(f.options.databasePath);db.exec('PRAGMA foreign_keys=ON');try{const domain=createDomain(db);return await project({async request(method,input){return domain.execute(method,input);}},f.root);}finally{db.close();}}
test('version 33 Worker upgrade requires a verified external backup and leaves old rows intact',async t=>{
 const f=await fixture(t,{targetVersion:33}),p=await historicalProject(f);await assert.rejects(openStorage({...f.options,targetVersion:34}),{code:'UPGRADE_BACKUP_REQUIRED'});const current=await f.reopen({targetVersion:34,backupDirectory:join(f.root,'backup')}),info=await current.request('inspect',{});assert.equal(info.version,34);assert.equal((await current.request('getRun',{runId:p.runId})).projectId,p.projectId);assert.deepEqual(info.foreignKeyErrors,[]);const backup=new DatabaseSync(info.backupPath,{readOnly:true});try{assert.equal(backup.prepare('PRAGMA user_version').get().user_version,33);assert.equal(backup.prepare('SELECT count(*) n FROM runs').get().n,1);assert.equal(backup.prepare("SELECT name FROM sqlite_master WHERE name='preview_access_requests'").get(),undefined);}finally{backup.close();}await current.close();await assert.rejects(openStorage({...f.options,targetVersion:33}),{code:'MIGRATION_DOWNGRADE_FORBIDDEN'});
});
test('version 34 migration DDL, original rows and version markers roll back on failure then retry unchanged',async t=>{
 const f=await fixture(t,{targetVersion:33});await historicalProject(f);const db=new DatabaseSync(f.options.databasePath);db.exec('PRAGMA foreign_keys=ON');try{const original=db.prepare('SELECT * FROM runs').all(),bad=[...migrations.slice(0,33),{...migrations[33],sql:migrations[33].sql+'\nSELECT * FROM injected_missing_table;'}];assert.throws(()=>applyMigrations(db,bad,f.options.storeId),/injected_missing_table/);assert.equal(db.prepare('PRAGMA user_version').get().user_version,33);assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n,33);assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='preview_access_requests'").get(),undefined);assert.deepEqual(db.prepare('SELECT * FROM runs').all(),original);assert.equal(applyMigrations(db,migrations,f.options.storeId),34);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);assert.deepEqual(db.prepare('SELECT * FROM runs').all(),original);}finally{db.close();}
});
test('fresh access tables/history refuse invalid identities and event faults preserve atomic admission',async t=>{
 const f=await previewAccessFixture(t);await f.register();f.db.exec("CREATE TRIGGER cut_enroll BEFORE INSERT ON preview_write_gate_events BEGIN SELECT RAISE(ABORT,'enroll-cut'); END");await assert.rejects(f.enroll(),/enroll-cut/);assert.equal(f.get('SELECT count(*) n FROM preview_write_gates').n,0);f.db.exec('DROP TRIGGER cut_enroll');await f.enroll();
 f.db.exec("CREATE TRIGGER cut_prepare BEFORE INSERT ON preview_access_request_events BEGIN SELECT RAISE(ABORT,'prepare-cut'); END");await assert.rejects(f.prepare(),/prepare-cut/);assert.equal(f.get('SELECT count(*) n FROM preview_access_requests').n,0);f.db.exec('DROP TRIGGER cut_prepare');const r=await f.prepare();await f.call('beginPreviewAccessRequest',f.original(r));
 f.db.exec("CREATE TRIGGER cut_observe BEFORE INSERT ON preview_access_request_events WHEN NEW.revision=2 BEGIN SELECT RAISE(ABORT,'observe-cut'); END");await assert.rejects(f.call('recordPreviewAccessObservation',{...f.original(r),observation:{state:'FINISHED',httpStatus:200,responseSha256:hash('original'),checkedAt:new Date().toISOString()}}),/observe-cut/);assert.equal((await f.call('getPreviewAccessRequest',f.original(r))).state,'DISPATCHED');assert.equal((await f.call('getPreviewWriteGate',f.data)).pendingWrites,1);f.db.exec('DROP TRIGGER cut_observe');assert.equal(f.get('SELECT count(*) n FROM preview_access_request_events').n,2);
 assert.throws(()=>f.run('UPDATE preview_access_policies SET configuration_hash=?',hash('changed')),/PREVIEW_ACCESS_POLICY_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM preview_access_request_events'),/PREVIEW_ACCESS_REQUEST_EVENT_IMMUTABLE/);assert.throws(()=>f.run('DELETE FROM preview_write_gate_events'),/PREVIEW_WRITE_GATE_EVENT_IMMUTABLE/);assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('historical SQL bytes stay pinned; changed version 34 deployment SQL is rejected',async t=>{
 const f=await fixture(t),directory=join(f.root,'access-migrations');mkdirSync(directory);const manifest=[];for(const m of migrations){const sql=readFileSync(new URL('../packages/storage-sqlite/migrations/'+m.name,import.meta.url));assert.equal(digest(sql),m.sha256);manifest.push({version:m.version,name:m.name,sha256:m.sha256});}assert.equal(manifest.at(-1).version,34);assert.equal(migrations[32].sha256,'d0021aeba62b222844b8844d1af81fc8d18dde578adbf32d82ae073ea36e7e6f');
 const {writeFileSync}=await import('node:fs');for(const m of migrations)writeFileSync(join(directory,m.name),m.sql);writeFileSync(join(directory,'manifest.json'),JSON.stringify(manifest));writeFileSync(join(directory,migrations[33].name),migrations[33].sql+'\n-- changed deployment bytes');assert.throws(()=>readMigrations(directory),{code:'MIGRATION_CHECKSUM_MISMATCH'});
 const db=new DatabaseSync(':memory:');try{applyMigrations(db,migrations,randomUUID());assert.equal(db.prepare('PRAGMA user_version').get().user_version,34);}finally{db.close();}
});
