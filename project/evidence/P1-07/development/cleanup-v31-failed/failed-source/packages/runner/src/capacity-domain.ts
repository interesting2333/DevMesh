import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {canonical} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {previewReservationSchema,runnerCapacity} from './preview-reservation.js';
import type {RunnerCapacity,RunnerCapacityUsage,PreviewResourceLimits,PreviewReservation} from './preview-reservation.js';
import type {StoreInput} from './store-protocol.js';

const migration=`
ALTER TABLE runner_identity RENAME TO runner_identity_v2;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=3)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,3 FROM runner_identity_v2;
DROP TABLE runner_identity_v2;
CREATE TABLE preview_reservations(sequence INTEGER PRIMARY KEY,reservation_id TEXT NOT NULL UNIQUE,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,preview_id TEXT NOT NULL,dataset_id TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),limits_json TEXT NOT NULL CHECK(json_valid(limits_json)),state TEXT NOT NULL CHECK(state IN ('RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED')),revision INTEGER NOT NULL CHECK(revision>=0),instance_id TEXT,endpoint_json TEXT CHECK(endpoint_json IS NULL OR json_valid(endpoint_json)),fact_json TEXT CHECK(fact_json IS NULL OR json_valid(fact_json)),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),CHECK((state IN ('EXITED','CANCELLED') AND released_at IS NOT NULL) OR (state NOT IN ('EXITED','CANCELLED') AND released_at IS NULL)),CHECK(state<>'RESERVED' OR (instance_id IS NULL AND fact_json IS NULL)),CHECK(state<>'EXITED' OR instance_id IS NOT NULL)) STRICT;
CREATE UNIQUE INDEX exclusive_preview_reservation ON preview_reservations(preview_id) WHERE released_at IS NULL;
CREATE UNIQUE INDEX exclusive_preview_dataset ON preview_reservations(dataset_id) WHERE released_at IS NULL;
CREATE TABLE preview_reservation_events(reservation_id TEXT NOT NULL REFERENCES preview_reservations(reservation_id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(reservation_id,revision)) STRICT;
CREATE TRIGGER immutable_preview_reservation BEFORE UPDATE ON preview_reservations WHEN OLD.released_at IS NOT NULL OR NEW.sequence<>OLD.sequence OR NEW.reservation_id<>OLD.reservation_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.preview_id<>OLD.preview_id OR NEW.dataset_id<>OLD.dataset_id OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.limits_json<>OLD.limits_json OR NEW.created_at<>OLD.created_at OR (OLD.instance_id IS NOT NULL AND NEW.instance_id IS NOT OLD.instance_id) OR (OLD.endpoint_json IS NOT NULL AND NEW.endpoint_json IS NOT OLD.endpoint_json) BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_reservation BEFORE DELETE ON preview_reservations BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_IMMUTABLE'); END;
CREATE TRIGGER immutable_preview_reservation_event BEFORE UPDATE ON preview_reservation_events BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_reservation_event BEFORE DELETE ON preview_reservation_events BEGIN SELECT RAISE(ABORT,'PREVIEW_RESERVATION_EVENT_IMMUTABLE'); END;
PRAGMA user_version=3;`;
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
type Row=Record<string,string|number|null>;

/** Private to the Runner writer; physical facts must come from a trusted backend. */
export function createRunnerCapacityDomain(db:DatabaseSync,runnerId:string){
 const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as Row|undefined;
 const all=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as Row[];
 const exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const value=body();db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
 const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);
 if(version===2)tx(()=>{db.exec(migration);exec('INSERT INTO runner_schema_history VALUES(3,?,?)',hash(migration),new Date().toISOString());});
  else if(![3,4,5,6].includes(version))fail('RUNNER_STORE_IDENTITY_MISMATCH');
  if(get('SELECT sha256 FROM runner_schema_history WHERE version=3')?.sha256!==hash(migration)||get('SELECT version FROM runner_identity WHERE singleton=1')?.version!==(version===2?3:version))fail('RUNNER_MIGRATION_DRIFT');
 let capacity:RunnerCapacity|null=null;
 const configure=(input:RunnerCapacity):RunnerCapacity=>{const parsed=runnerCapacity.parse(input);if(capacity&&canonical(capacity)!==canonical(parsed))fail('RUNNER_CAPACITY_CONFIG_CHANGED');return capacity??=(Object.freeze(parsed));};
 const usage=():RunnerCapacityUsage=>{
  const jobs=all("SELECT request_json FROM jobs WHERE state NOT IN ('QUEUED','EXITED')").map(r=>JSON.parse(String(r.request_json)).resourceLimits as PreviewResourceLimits);
  const previews=all('SELECT limits_json FROM preview_reservations WHERE released_at IS NULL').map(r=>JSON.parse(String(r.limits_json)) as PreviewResourceLimits);
  const used=[...jobs,...previews];return {slots:used.length,jobSlots:jobs.length,previewSlots:previews.length,cpu:used.reduce((sum,l)=>sum+l.cpu,0),memoryMiB:used.reduce((sum,l)=>sum+l.memoryMiB,0)};
 };
 const fits=(limits:Pick<PreviewResourceLimits,'cpu'|'memoryMiB'>,budget:RunnerCapacity)=>{const c=configure(budget),u=usage();return u.slots<c.maximumJobs&&u.cpu+limits.cpu<=c.cpu&&u.memoryMiB+limits.memoryMiB<=c.memoryMiB;};
 const view=(r:Row):PreviewReservation=>previewReservationSchema.parse({reservationId:r.reservation_id,controllerId:r.controller_id,request:JSON.parse(String(r.request_json)),requestHash:r.request_hash,resourceLimits:JSON.parse(String(r.limits_json)),state:r.state,revision:r.revision,instanceId:r.instance_id,endpoint:r.endpoint_json?JSON.parse(String(r.endpoint_json)):null,fact:r.fact_json?JSON.parse(String(r.fact_json)):null,createdAt:r.created_at,updatedAt:r.updated_at,releasedAt:r.released_at});
 const owned=(controllerId:string,id:string)=>get('SELECT * FROM preview_reservations WHERE reservation_id=? AND controller_id=?',id,controllerId)??fail('PREVIEW_RESERVATION_NOT_FOUND',404);
 const bound=(i:{controllerId:string;reservationId:string;requestHash:string})=>{const r=owned(i.controllerId,i.reservationId);if(r.request_hash!==i.requestHash)fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');return r;};
 const event=(r:Row)=>exec('INSERT INTO preview_reservation_events VALUES(?,?,?,?)',String(r.reservation_id),Number(r.revision),canonical(view(r)),String(r.updated_at));
 const changed=(r:Row)=>{const current=owned(String(r.controller_id),String(r.reservation_id));event(current);return view(current);};
 return {
  recordRemoved(i:{controllerId:string;reservationId:string;requestHash:string},checkedAt:string){const r=bound(i);if(r.released_at!==null)return;if(r.instance_id===null||r.state==='RESERVED')fail('PREVIEW_CLEANUP_ORIGINAL_UNKNOWN');const request=JSON.parse(String(r.request_json)),fact={previewId:request.previewId,datasetId:request.datasetId,imageDigest:request.imageDigest,state:'REMOVED',instanceId:r.instance_id,endpoint:null,checkedAt},at=new Date().toISOString();exec("UPDATE preview_reservations SET state='REMOVED',revision=revision+1,fact_json=?,updated_at=?,released_at=? WHERE reservation_id=?",canonical(fact),at,at,i.reservationId);changed(r);},
  fits,
  capacityConfigure:configure,
  capacityUsage(){return {capacity,usage:usage()};},
  previewReserve(i:StoreInput<'previewReserve'>){return tx(()=>{
   if(i.request.runnerId!==runnerId||i.requestHash!==hash(i.request))fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');
   const old=get('SELECT * FROM preview_reservations WHERE controller_id=? AND operation_id=?',i.controllerId,i.request.operationId);
   if(old){if(old.request_hash!==i.requestHash||old.limits_json!==canonical(i.resourceLimits))fail('IDEMPOTENCY_KEY_REUSED');return view(old);}
   if(Date.parse(i.request.expiresAt)<=Date.now())fail('PREVIEW_RESERVATION_EXPIRED');
   if(get('SELECT 1 FROM preview_reservations WHERE released_at IS NULL AND (preview_id=? OR dataset_id=?)',i.request.previewId,i.request.datasetId))fail('PREVIEW_RESERVATION_BUSY');
   if(!fits(i.resourceLimits,i.capacity))fail('RUNNER_CAPACITY_EXHAUSTED',429);
   const id='reservation_'+randomUUID().replaceAll('-',''),now=new Date().toISOString();
   exec("INSERT INTO preview_reservations(reservation_id,controller_id,operation_id,preview_id,dataset_id,request_hash,request_json,limits_json,state,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'RESERVED',0,?,?)",id,i.controllerId,i.request.operationId,i.request.previewId,i.request.datasetId,i.requestHash,canonical(i.request),canonical(i.resourceLimits),now,now);
   return changed(owned(i.controllerId,id));
  });},
  previewReservationGet(i:StoreInput<'previewReservationGet'>){return view(owned(i.controllerId,i.reservationId));},
  previewReservationByOperation(i:StoreInput<'previewReservationByOperation'>){const r=get('SELECT * FROM preview_reservations WHERE controller_id=? AND operation_id=?',i.controllerId,i.operationId);return r?view(r):null;},
  previewReservationPage(i:StoreInput<'previewReservationPage'>){const limit=i.limit??20,rows=all('SELECT * FROM preview_reservations WHERE controller_id=? AND released_at IS NULL AND sequence>? ORDER BY sequence LIMIT ?',i.controllerId,i.afterSequence??0,limit+1),more=rows.length>limit,items=rows.slice(0,limit).map(r=>({sequence:Number(r.sequence),reservation:view(r)}));return {items,nextSequence:more?items.at(-1)!.sequence:null};},
   previewReservationDispatch(i:StoreInput<'previewReservationDispatch'>){return tx(()=>{const r=bound(i);if(r.state!=='RESERVED')return {dispatch:false,reservation:view(r)};const life=get('SELECT state,expired_at FROM preview_lifecycles WHERE reservation_id=?',i.reservationId);if(life&&(life.state!=='PREVIEW'||life.expired_at!==null))fail('PREVIEW_EXPIRY_CLAIMED');if(Date.parse(JSON.parse(String(r.request_json)).expiresAt)<=Date.now())fail('PREVIEW_RESERVATION_EXPIRED');exec("UPDATE preview_reservations SET state='DISPATCHED',revision=revision+1,updated_at=? WHERE reservation_id=?",new Date().toISOString(),i.reservationId);return {dispatch:true,reservation:changed(r)};});},
  previewReservationCancel(i:StoreInput<'previewReservationCancel'>){return tx(()=>{const r=bound(i);if(r.state==='CANCELLED')return view(r);if(r.state!=='RESERVED')fail('PREVIEW_RESERVATION_DISPATCHED');const now=new Date().toISOString();exec("UPDATE preview_reservations SET state='CANCELLED',revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?",now,now,i.reservationId);return changed(r);});},
  previewReservationRecord(i:StoreInput<'previewReservationRecord'>){return tx(()=>{
   const r=bound(i),request=JSON.parse(String(r.request_json)),f=i.fact;if(f.state==='REMOVED')fail('PREVIEW_REMOVAL_PROOF_REQUIRED');
   if(f.previewId!==request.previewId||f.datasetId!==request.datasetId||f.imageDigest!==request.imageDigest)fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');
   if(r.fact_json===canonical(f))return view(r);
   if(r.revision!==i.expectedRevision)fail('PREVIEW_RESERVATION_REVISION_CONFLICT');
   if(['RESERVED','CANCELLED','EXITED','REMOVED'].includes(String(r.state)))fail('PREVIEW_RESERVATION_NOT_OBSERVABLE');
   const at=Date.parse(f.checkedAt),previous=r.fact_json?JSON.parse(String(r.fact_json)):null;
   if(at>Date.now()||at<Date.parse(String(r.created_at))||previous&&at<Date.parse(previous.checkedAt))fail('PREVIEW_RESERVATION_OBSERVATION_STALE');
   if(r.instance_id!==null&&f.instanceId!==null&&r.instance_id!==f.instanceId)fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');
   if(r.endpoint_json!==null&&f.endpoint!==null&&r.endpoint_json!==canonical(f.endpoint))fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');
   const state=f.state==='EXITED'?'EXITED':f.state==='UNKNOWN'?'UNKNOWN':f.state==='CREATED'?'DISPATCHED':'ACTIVE',now=new Date().toISOString();
   exec('UPDATE preview_reservations SET state=?,revision=revision+1,instance_id=coalesce(instance_id,?),endpoint_json=coalesce(endpoint_json,?),fact_json=?,updated_at=?,released_at=? WHERE reservation_id=?',state,f.instanceId,f.endpoint?canonical(f.endpoint):null,canonical(f),now,state==='EXITED'?now:null,i.reservationId);
   return changed(r);
  });},
 };
}
