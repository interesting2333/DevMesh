import {randomUUID} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {z} from 'zod';
import {RunnerError} from './protocol.js';
// Trusted adapter for the pinned baseline, never SQL supplied by a model.
export const webCrudDatasetProfile={templateVersion:'web-crud-v1',schemaRevision:'web-crud-v1.schema.1'} as const;
export const webCrudDatasetMarker=z.strictObject({kind:z.literal('web-crud-dataset'),templateId:z.literal('web-crud-v1'),layoutVersion:z.literal(1),datasetId:z.uuid()});
const schema=[
 'CREATE TABLE dataset_identity (singleton INTEGER PRIMARY KEY CHECK(singleton=1),dataset_id TEXT NOT NULL) STRICT',
 "CREATE TABLE tasks (id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('todo','doing','done')),revision INTEGER NOT NULL CHECK(revision>0),createdAt TEXT NOT NULL,updatedAt TEXT NOT NULL) STRICT",
 'CREATE TABLE receipts (key TEXT PRIMARY KEY,request_hash TEXT NOT NULL,response TEXT NOT NULL) STRICT',
];
const normalize=(sql:string)=>sql.replace(/\s/g,'').toLowerCase();
const task=z.strictObject({id:z.uuid(),title:z.string().refine(v=>v.trim().length>0&&Array.from(v).length<=120),description:z.string().refine(v=>Array.from(v).length<=4000),status:z.enum(['todo','doing','done']),revision:z.number().int().positive(),createdAt:z.iso.datetime(),updatedAt:z.iso.datetime()});
export function validateDatasetProfile(db:DatabaseSync,appDatasetId:string){
 const definitions=db.prepare("SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all();
 if(Number(db.prepare('PRAGMA user_version').get()!.user_version)!==1||definitions.length!==schema.length||definitions.some(r=>typeof r.sql!=='string'||!schema.some(s=>normalize(s)===normalize(String(r.sql))))||db.prepare('SELECT dataset_id FROM dataset_identity WHERE singleton=1').get()?.dataset_id!==appDatasetId||Number(db.prepare('SELECT count(*) n FROM dataset_identity').get()!.n)!==1||db.prepare('PRAGMA quick_check').get()?.quick_check!=='ok'||db.prepare('PRAGMA foreign_key_check').get())throw new RunnerError('DATASET_PROFILE_INTEGRITY',409);
 const tasks=db.prepare('SELECT * FROM tasks LIMIT 1001').all();if(tasks.length>1000)throw new RunnerError('DATASET_PROFILE_LIMIT',413);for(const row of tasks)task.parse(row);
 if(Number(db.prepare('SELECT count(*) n FROM receipts').get()!.n)>10000)throw new RunnerError('DATASET_PROFILE_LIMIT',413);
}
export function initializeDatasetProfile(db:DatabaseSync,appDatasetId:string,mode:'EMPTY'|'DEMO',time:string){
 db.exec('PRAGMA synchronous=FULL; BEGIN IMMEDIATE;');try{
  for(const sql of schema)db.exec(sql);db.exec('PRAGMA user_version=1');db.prepare('INSERT INTO dataset_identity VALUES(1,?)').run(appDatasetId);
  if(mode==='DEMO')for(const [title,description,status] of [['欢迎使用任务看板','这条记录来自明确选择的演示数据。','todo'],['尝试编辑任务','预览中的修改只写入当前隔离数据集。','doing']])db.prepare('INSERT INTO tasks VALUES(?,?,?,?,1,?,?)').run(randomUUID(),title!,description!,status!,time,time);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}
