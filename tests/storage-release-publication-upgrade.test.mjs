import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readMigrations,applyMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {committedPublicationFixture} from './fixtures/release-publication.mjs';
import {sourceCompletionFixture} from './fixtures/acceptance-abort-completion.mjs';

const snapshot=db=>db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({name})=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]);
const schema=db=>db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
test('v41 committed intent upgrades only to PENDING and v42 failure rolls back all DDL/history',{timeout:480000},async t=>{
 const base=await committedPublicationFixture(t),root=await mkdtemp(join(tmpdir(),'devmesh-publication-upgrade-')),db=new DatabaseSync(join(root,'legacy.sqlite')),m=readMigrations(),id=base.get('SELECT store_id FROM store_metadata').store_id;t.after(async()=>{db.close();await rm(root,{recursive:true,force:true});});db.exec('PRAGMA foreign_keys=ON');applyMigrations(db,m,id,1,41);
 // Materialize original T5 metadata in a fresh v41 schema. This is an explicit
 // historical fixture, not an application downgrade or execution of old T5 code.
 // Suppress enrollment triggers only while loading the complete snapshot; restore
 // every exact original trigger and keep foreign keys enabled throughout.
 const triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();db.exec('BEGIN; PRAGMA defer_foreign_keys=ON');try{for(const {name} of triggers)db.exec('DROP TRIGGER '+name);for(const [name] of snapshot(db)){if(['schema_migrations','store_metadata'].includes(name))continue;const rows=base.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all();for(const row of rows){const keys=Object.keys(row);db.prepare('INSERT INTO '+name+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(row));}}for(const {sql} of triggers)db.exec(sql);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 const before=snapshot(db),ddl=schema(db);for(const kind of ['ddl','history']){
  if(kind==='history')db.exec("CREATE TRIGGER explicit_v42_cut BEFORE INSERT ON schema_migrations WHEN NEW.version=42 BEGIN SELECT RAISE(ABORT,'EXPLICIT_V42_CUT'); END");const selected=kind==='ddl'?[...m.slice(0,41),{...m[41],sql:m[41].sql+'\nSELECT * FROM explicit_v42_cut;'}]:m;assert.throws(()=>applyMigrations(db,selected,id),/explicit_v42_cut/i);assert.equal(db.prepare('PRAGMA user_version').get().user_version,41);assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys,1);assert.deepEqual(snapshot(db),before);if(kind==='history')db.exec('DROP TRIGGER explicit_v42_cut');assert.deepEqual(schema(db),ddl);
 }
 assert.equal(applyMigrations(db,m,id,1,42),42);for(const [name,rows] of before)if(name!=='schema_migrations')assert.deepEqual(db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),rows,name);const pending=db.prepare('SELECT * FROM release_publications').get();assert.equal(pending.state,'PENDING');assert.equal(pending.revision,1);assert.equal(pending.observation_sequence,0);for(const k of ['basis_json','proof_hash','error_code','dispatched_at','published_at'])assert.equal(pending[k],null,k);assert.equal(pending.created_at,base.publication.acceptedAt);assert.equal(db.prepare('SELECT count(*) n FROM release_publication_events').get().n,1);for(const n of ['release_publication_proofs','release_publication_observations','release_route_bindings'])assert.equal(db.prepare('SELECT count(*) n FROM '+n).get().n,0,n);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('v41 abort completion and unresolved original writes survive v42 without fabricated publication',async t=>{
 const f=await sourceCompletionFixture(t,{targetVersion:40,unresolvedWrite:true}),m=readMigrations(),id=f.get('SELECT store_id FROM store_metadata').store_id;applyMigrations(f.db,m,id,1,41);const before=snapshot(f.db);assert.equal(applyMigrations(f.db,m,id,1,42),42);for(const [name,rows] of before)if(name!=='schema_migrations')assert.deepEqual(f.db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),rows,name);assert.equal(f.get('SELECT count(*) n FROM release_publications').n,0);assert.equal(f.get("SELECT count(*) n FROM preview_access_requests WHERE state='UNKNOWN'").n,1);assert.equal(f.get('SELECT state FROM preview_write_gates WHERE dataset_id=?',f.d.datasetId).state,'CLOSED');assert.deepEqual(f.db.prepare('PRAGMA foreign_key_check').all(),[]);
});
