import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { openStorage } from '../packages/storage-sqlite/dist/index.mjs';
import { readMigrations, applyMigrations, checkHistory, digest, transaction } from '../packages/storage-sqlite/dist/migrations.mjs';
import { fixture } from './fixtures/storage-data.mjs';
const migrations=readMigrations();

test('formal empty installation supports each previous version and preserves data through backups',async t=>{
  for(const targetVersion of [1,2]) {
    const f=await fixture(t,{targetVersion});
    const contentHash='a'.repeat(64);
    assert.equal((await f.storage.request('inspect',{})).version,targetVersion);
    await f.storage.close();
    const seed=new DatabaseSync(f.options.databasePath);seed.prepare("INSERT INTO content_objects VALUES(?,1,?,'text/plain','READY',?)").run(contentHash,'sha256/aa/'+contentHash,new Date().toISOString());seed.close();
    await assert.rejects(openStorage({...f.options,targetVersion:3}),e=>e.code==='UPGRADE_BACKUP_REQUIRED');
    const current=await f.reopen({targetVersion:3,backupDirectory:join(f.root,'backup')});
    const info=await current.request('inspect',{});
    assert.equal(info.version,3);assert.equal(info.counts.content_objects,1);assert.ok(info.backupPath);
    const backup=new DatabaseSync(info.backupPath,{readOnly:true});
    try{ assert.equal(backup.prepare('PRAGMA user_version').get().user_version,targetVersion);assert.equal(backup.prepare('SELECT count(*) n FROM content_objects').get().n,1); }finally{backup.close();}
    assert.equal(readdirSync(join(f.root,'backup')).length,1);
  }
});

test('a failed migration atomically rolls back DDL, row changes and version marker',()=>{
  const db=new DatabaseSync(':memory:'), storeId=randomUUID();
  try {
    applyMigrations(db,migrations,storeId,1,2);
    const bad=[...migrations.slice(0,2),{version:3,name:'0003-failed.sql',sha256:digest('failed'),sql:'CREATE TABLE partial(value TEXT); INSERT INTO partial VALUES(\'x\'); SELECT * FROM definitely_missing;'}];
    assert.throws(()=>applyMigrations(db,bad,storeId));
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='partial'").get(),undefined);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,2);
    assert.equal(db.prepare('SELECT count(*) n FROM schema_migrations').get().n,2);
    assert.equal(applyMigrations(db,migrations,storeId),3);
  }finally{db.close();}
});

test('unknown schema, future/gapped/tampered history and downgrade are rejected',()=>{
  const db=new DatabaseSync(':memory:'), id=randomUUID();
  try{
    db.exec('CREATE TABLE foreign_table(value TEXT)');assert.throws(()=>checkHistory(db,migrations),e=>e.code==='DATABASE_UNRECOGNIZED');db.exec('DROP TABLE foreign_table');
    applyMigrations(db,migrations,id);
    assert.throws(()=>applyMigrations(db,migrations,id,1,2),e=>e.code==='MIGRATION_DOWNGRADE_FORBIDDEN');
    db.exec("UPDATE schema_migrations SET sha256='tampered' WHERE version=2");
    assert.throws(()=>checkHistory(db,migrations),e=>e.code==='MIGRATION_HISTORY_MISMATCH');
    db.prepare('UPDATE schema_migrations SET sha256=? WHERE version=2').run(migrations[1].sha256);
    db.exec("INSERT INTO schema_migrations VALUES(4,'0004-future.sql','unknown','time')");
    assert.throws(()=>checkHistory(db,migrations),e=>e.code==='MIGRATION_HISTORY_MISMATCH');
    db.exec('DELETE FROM schema_migrations WHERE version IN(2,4)');
    assert.throws(()=>checkHistory(db,migrations),e=>e.code==='MIGRATION_HISTORY_MISMATCH');
  }finally{db.close();}
});

test('illegal asynchronous transaction cannot silently pass',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    assert.throws(()=>transaction(db,()=>{db.exec('CREATE TABLE rolled_back(value TEXT)');return Promise.resolve();}),e=>e.code==='ASYNC_TRANSACTION_FORBIDDEN');
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='rolled_back'").get(),undefined);
    assert.equal(db.isTransaction,false);
  }finally{db.close();}
});

test('modified deployment SQL is rejected before it can be applied',async t=>{
  const f=await fixture(t), directory=join(f.root,'tampered-migrations');
  cpSync(new URL('../packages/storage-sqlite/dist/migrations/',import.meta.url),directory,{recursive:true});
  writeFileSync(join(directory,migrations[0].name),'CREATE TABLE substituted(value TEXT);');
  assert.throws(()=>readMigrations(directory),e=>e.code==='MIGRATION_CHECKSUM_MISMATCH');
});

test('unrecognized file and overlapping backup directory cannot be adopted automatically',async t=>{
  const f=await fixture(t,{targetVersion:2});await f.storage.close();
  mkdirSync(join(f.root,'db','backups'));
  await assert.rejects(openStorage({...f.options,targetVersion:3,backupDirectory:join(f.root,'db','backups')}),e=>e.code==='BACKUP_PATH_OVERLAP');
  const unknown=join(f.root,'db','unknown.sqlite'),db=new DatabaseSync(unknown);db.exec('CREATE TABLE stranger(id TEXT)');db.close();
  await assert.rejects(openStorage({...f.options,databasePath:unknown}),e=>e.code==='DATABASE_UNRECOGNIZED');
  const empty=join(f.root,'db','empty.sqlite');writeFileSync(empty,'');
  await assert.rejects(openStorage({...f.options,databasePath:empty}),e=>e.code==='DATABASE_UNRECOGNIZED');
});
