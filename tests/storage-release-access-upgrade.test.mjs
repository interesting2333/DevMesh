import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readMigrations,applyMigrations,checkHistory} from '../packages/storage-sqlite/dist/migrations.mjs';
import {committedPublicationFixture,seedUnknownPublicationWrite} from './fixtures/release-publication.mjs';
const rows=db=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]);
const schema=db=>db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
test('v42 history and unresolved Preview writes survive v43; failure rolls back DDL/history and drift is rejected',{timeout:480000},async t=>{
 const base=await committedPublicationFixture(t);await seedUnknownPublicationWrite(base,base.publication.request.preparation.target.datasetId);
 const root=await mkdtemp(join(tmpdir(),'devmesh-release-access-upgrade-')),db=new DatabaseSync(join(root,'legacy.sqlite')),m=readMigrations(),id=base.get('SELECT store_id FROM store_metadata').store_id;t.after(async()=>{db.close();await rm(root,{recursive:true,force:true});});db.exec('PRAGMA foreign_keys=ON');applyMigrations(db,m,id,1,42);
 // Explicit historical fixture loading: preserve original rows, not old-code execution.
 const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();db.exec('BEGIN; PRAGMA defer_foreign_keys=ON');try{for(const {name} of triggers)db.exec('DROP TRIGGER '+name);for(const [name] of rows(db)){if(['schema_migrations','store_metadata'].includes(name))continue;for(const row of base.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()){const oldColumns=new Set(db.prepare('PRAGMA table_info('+name+')').all().map(c=>c.name)),keys=Object.keys(row).filter(k=>oldColumns.has(k));db.prepare('INSERT INTO '+name+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));}}for(const {sql} of triggers)db.exec(sql);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 const before=rows(db),ddl=schema(db);
 for(const cut of ['ddl','history']){
  if(cut==='history')db.exec("CREATE TRIGGER explicit_v43_cut BEFORE INSERT ON schema_migrations WHEN NEW.version=43 BEGIN SELECT RAISE(ABORT,'EXPLICIT_V43_CUT'); END");
  const selected=cut==='ddl'?[...m.slice(0,42),{...m[42],sql:m[42].sql+'\nSELECT * FROM explicit_v43_cut;'}]:m;assert.throws(()=>applyMigrations(db,selected,id),/explicit_v43_cut/i);assert.equal(checkHistory(db,m),42);assert.deepEqual(rows(db),before);if(cut==='history')db.exec('DROP TRIGGER explicit_v43_cut');assert.deepEqual(schema(db),ddl);
 }
 assert.equal(applyMigrations(db,m,id,1,43),43);for(const [name,old] of before)if(name!=='schema_migrations')assert.deepEqual(db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),old,name);
 assert.equal(db.prepare('SELECT count(*) n FROM business_pending_writes').get().n,1);assert.equal(db.prepare('SELECT purpose FROM business_pending_writes').get().purpose,'PREVIEW');for(const name of ['release_access_requests','release_tickets','release_sessions','release_credential_events'])assert.equal(db.prepare('SELECT count(*) n FROM '+name).get().n,0);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
 const changed=m.map(x=>x.version===42?{...x,sha256:'0'.repeat(64)}:x);assert.throws(()=>checkHistory(db,changed),{code:'MIGRATION_HISTORY_MISMATCH'});assert.equal(checkHistory(db,m),43);
});
