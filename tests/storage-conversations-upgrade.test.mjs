import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {readMigrations,applyMigrations} from '../packages/storage-sqlite/dist/migrations.mjs';
import {workbenchPlanningFixture} from './fixtures/workbench-planning.mjs';

test('v54 populated projects, plans, original operations and confirmations survive v55; late failure rolls back all new tables',async t=>{
 const f=await workbenchPlanningFixture(t);await f.storage.request('confirmReviewedPlan',{meta:{principalId:'user_1',scopeId:f.runId,idempotencyKey:randomUUID()},runId:f.runId,ifMatch:'"r'+f.review.resourceRevision+'"',planRevision:f.review.planRevision,requirementRevision:f.review.requirementRevision,reviewHash:f.review.reviewHash});
 const db=new DatabaseSync(':memory:'),m=readMigrations(),storeId=f.sql('SELECT store_id FROM store_metadata')[0].store_id;t.after(()=>db.close());db.exec('PRAGMA foreign_keys=ON');applyMigrations(db,m,storeId,1,54);
 const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name),triggers=db.prepare("SELECT name,sql FROM sqlite_master WHERE type='trigger'").all();
 db.exec('BEGIN; PRAGMA defer_foreign_keys=ON');try{for(const r of triggers)db.exec('DROP TRIGGER '+r.name);for(const name of names){if(['schema_migrations','store_metadata'].includes(name))continue;for(const row of f.sql('SELECT * FROM '+name+' ORDER BY rowid')){const keys=Object.keys(row);db.prepare('INSERT OR REPLACE INTO '+name+'('+keys.join(',')+') VALUES('+keys.map(()=>'?').join(',')+')').run(...Object.values(row));}}for(const r of triggers)db.exec(r.sql);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 const rows=()=>names.map(name=>[name,db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all()]),before=rows(),schema=db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all();
 const broken=m.map(v=>v.version===55?{...v,sql:v.sql+'\nSELECT * FROM late_conversation_migration_fault;'}:v);assert.throws(()=>applyMigrations(db,broken,storeId));assert.deepEqual(rows(),before);assert.deepEqual(db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all(),schema);assert.equal(db.prepare('PRAGMA user_version').get().user_version,54);
 applyMigrations(db,m,storeId);for(const [name,old] of before)if(name!=='schema_migrations')assert.deepEqual(db.prepare('SELECT * FROM '+name+' ORDER BY rowid').all(),old,name);assert.equal(db.prepare('SELECT count(*) n FROM conversation_plan_admissions').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM plan_execution_admissions').get().n,1);assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
});
