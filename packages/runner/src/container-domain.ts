import {createHash} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {canonical,previewStopRequest} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {previewContainerProfile,previewContainerActionSchema,previewContainerNames} from './preview-container.js';
import type {PreviewContainerJournal,PreviewContainerActionRecord} from './preview-container.js';
import type {StoreInput} from './store-protocol.js';
const migration=`
ALTER TABLE runner_identity RENAME TO runner_identity_v3;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=4)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,4 FROM runner_identity_v3;
DROP TABLE runner_identity_v3;
CREATE UNIQUE INDEX preview_reservation_request_binding ON preview_reservations(reservation_id,request_hash);
CREATE TABLE preview_container_profiles(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,profile_hash TEXT NOT NULL,profile_json TEXT NOT NULL CHECK(json_valid(profile_json)),network_id TEXT,container_id TEXT,created_at TEXT NOT NULL,UNIQUE(reservation_id,profile_hash),FOREIGN KEY(reservation_id,request_hash) REFERENCES preview_reservations(reservation_id,request_hash)) STRICT;
CREATE TABLE preview_container_actions(reservation_id TEXT NOT NULL,profile_hash TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('NETWORK_CREATE','CREATE','START','STOP')),operation_id TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('SENT','OBSERVED')),observation_json TEXT CHECK(observation_json IS NULL OR json_valid(observation_json)),created_at TEXT NOT NULL,observed_at TEXT,PRIMARY KEY(reservation_id,kind),FOREIGN KEY(reservation_id,profile_hash) REFERENCES preview_container_profiles(reservation_id,profile_hash),CHECK((state='SENT' AND observation_json IS NULL AND observed_at IS NULL) OR (state='OBSERVED' AND observation_json IS NOT NULL AND observed_at IS NOT NULL))) STRICT;
CREATE TRIGGER immutable_preview_container_profile BEFORE UPDATE ON preview_container_profiles WHEN NEW.reservation_id<>OLD.reservation_id OR NEW.request_hash<>OLD.request_hash OR NEW.profile_hash<>OLD.profile_hash OR NEW.profile_json<>OLD.profile_json OR NEW.created_at<>OLD.created_at OR (OLD.network_id IS NOT NULL AND NEW.network_id IS NOT OLD.network_id) OR (OLD.container_id IS NOT NULL AND NEW.container_id IS NOT OLD.container_id) BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_container_profile BEFORE DELETE ON preview_container_profiles BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_PROFILE_IMMUTABLE'); END;
CREATE TRIGGER immutable_preview_container_action BEFORE UPDATE ON preview_container_actions WHEN OLD.state='OBSERVED' OR NEW.reservation_id<>OLD.reservation_id OR NEW.profile_hash<>OLD.profile_hash OR NEW.kind<>OLD.kind OR NEW.operation_id<>OLD.operation_id OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_ACTION_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_container_action BEFORE DELETE ON preview_container_actions BEGIN SELECT RAISE(ABORT,'PREVIEW_CONTAINER_ACTION_IMMUTABLE'); END;
PRAGMA user_version=4;`;
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
type Row=Record<string,string|number|null>;
export function createPreviewContainerDomain(db:DatabaseSync,actionGuard:(input:StoreInput<'previewContainerActionBegin'>)=>void){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const r=body();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
  const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);if(version===3)tx(()=>{db.exec(migration);exec('INSERT INTO runner_schema_history VALUES(4,?,?)',hash(migration),new Date().toISOString());});else if(![4,5,6,7,8].includes(version))fail('RUNNER_STORE_IDENTITY_MISMATCH');
  if(get('SELECT sha256 FROM runner_schema_history WHERE version=4')?.sha256!==hash(migration)||get('SELECT version FROM runner_identity WHERE singleton=1')?.version!==(version===3?4:version))fail('RUNNER_MIGRATION_DRIFT');
 const reservation=(i:{controllerId:string;reservationId:string;requestHash:string})=>{const r=get('SELECT * FROM preview_reservations WHERE reservation_id=? AND controller_id=?',i.reservationId,i.controllerId)??fail('PREVIEW_RESERVATION_NOT_FOUND',404);if(r.request_hash!==i.requestHash)fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');return r;};
 const profile=(id:string)=>get('SELECT * FROM preview_container_profiles WHERE reservation_id=?',id)??fail('PREVIEW_CONTAINER_JOURNAL_NOT_FOUND',404);
 const actionView=(r:Row):PreviewContainerActionRecord=>previewContainerActionSchema.parse({kind:r.kind,operationId:r.operation_id,requestHash:r.request_hash,request:JSON.parse(String(r.request_json)),state:r.state,observation:r.observation_json?JSON.parse(String(r.observation_json)):null,createdAt:r.created_at,observedAt:r.observed_at});
 const view=(p:Row):PreviewContainerJournal=>({profile:previewContainerProfile.parse(JSON.parse(String(p.profile_json))),profileHash:String(p.profile_hash),networkId:p.network_id as string|null,containerId:p.container_id as string|null,actions:(db.prepare('SELECT * FROM preview_container_actions WHERE reservation_id=? ORDER BY created_at,kind').all(String(p.reservation_id)) as Row[]).map(actionView)});
 return {
  previewContainerPrepare(i:StoreInput<'previewContainerPrepare'>){return tx(()=>{const r=reservation(i),old=get('SELECT * FROM preview_container_profiles WHERE reservation_id=?',i.reservationId),p=i.profile,names=previewContainerNames(i.reservationId);if(p.reservationId!==i.reservationId||p.requestHash!==i.requestHash||canonical(p.resourceLimits)!==r.limits_json||p.networkName!==names.networkName||p.containerName!==names.containerName)fail('PREVIEW_CONTAINER_PROFILE_CHANGED');if(old){if(old.profile_json!==canonical(p))fail('PREVIEW_CONTAINER_PROFILE_CHANGED');return view(old);}if(r.state!=='RESERVED')fail('PREVIEW_CONTAINER_NOT_PREPARED');exec('INSERT INTO preview_container_profiles VALUES(?,?,?,?,NULL,NULL,?)',i.reservationId,i.requestHash,hash(p),canonical(p),new Date().toISOString());return view(profile(i.reservationId));});},
  previewContainerGet(i:StoreInput<'previewContainerGet'>){reservation(i);const p=get('SELECT * FROM preview_container_profiles WHERE reservation_id=?',i.reservationId);return p?view(p):null;},
  previewContainerActionBegin(i:StoreInput<'previewContainerActionBegin'>){return tx(()=>{
   const r=reservation(i),p=profile(i.reservationId),a=i.action,original=JSON.parse(String(r.request_json));if(a.requestHash!==hash(a.request))fail('PREVIEW_CONTAINER_ACTION_CHANGED');
   if(a.kind==='STOP'){
    const stop=previewStopRequest.parse(a.request);
    if(stop.startOperationId!==original.operationId||stop.startRequestHash!==r.request_hash||stop.instanceId!==p.container_id)fail('PREVIEW_CONTAINER_ACTION_CHANGED');
    for(const k of ['projectId','runId','candidateId','policyHash','backendRef','runnerId','previewId','datasetId','imageDigest'] as const)if(stop[k]!==original[k])fail('PREVIEW_CONTAINER_ACTION_CHANGED');
   }else if(a.requestHash!==r.request_hash||canonical(a.request)!==r.request_json)fail('PREVIEW_CONTAINER_ACTION_CHANGED');
   const old=get('SELECT * FROM preview_container_actions WHERE reservation_id=? AND kind=?',i.reservationId,a.kind);if(old){if(old.operation_id!==a.request.operationId||old.request_hash!==a.requestHash)fail('PREVIEW_CONTAINER_ACTION_CHANGED');return {dispatch:false,journal:view(p)};}
    actionGuard(i);
   if(r.state==='RESERVED'||r.released_at!==null)fail('PREVIEW_CONTAINER_DISPATCH_REQUIRED');
   if(a.kind!=='STOP'&&Date.parse(original.expiresAt)<=Date.now())fail('PREVIEW_RESERVATION_EXPIRED');
   if(a.kind==='CREATE'&&!p.network_id||a.kind==='START'&&!p.container_id||a.kind==='STOP'&&!p.container_id)fail('PREVIEW_CONTAINER_PREDECESSOR_UNKNOWN');
   if(a.kind==='START'&&get("SELECT 1 FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'",i.reservationId))fail('PREVIEW_CONTAINER_STOPPING');
   exec("INSERT INTO preview_container_actions VALUES(?,?,?,?,?,?,'SENT',NULL,?,NULL)",i.reservationId,String(p.profile_hash),a.kind,a.request.operationId,a.requestHash,canonical(a.request),new Date().toISOString());return {dispatch:true,journal:view(p)};
  });},
  previewContainerActionObserve(i:StoreInput<'previewContainerActionObserve'>){return tx(()=>{
   reservation(i);const p=profile(i.reservationId),a=get('SELECT * FROM preview_container_actions WHERE reservation_id=? AND kind=?',i.reservationId,i.kind)??fail('PREVIEW_CONTAINER_ACTION_NOT_FOUND',404),o=i.observation;
   if(a.request_hash!==i.actionRequestHash)fail('PREVIEW_CONTAINER_ACTION_CHANGED');if(a.state==='OBSERVED'){if(a.observation_json!==canonical(o))fail('PREVIEW_CONTAINER_OBSERVATION_IMMUTABLE');return view(p);}
   if(Date.parse(o.checkedAt)<Date.parse(String(a.created_at))||Date.parse(o.checkedAt)>Date.now())fail('PREVIEW_CONTAINER_OBSERVATION_STALE');
   if(i.kind==='NETWORK_CREATE'&&o.state!=='CREATED'||i.kind==='START'&&o.state==='CREATED'||i.kind==='STOP'&&o.state!=='EXITED')fail('PREVIEW_CONTAINER_OUTCOME_UNVERIFIED');
   const field=i.kind==='NETWORK_CREATE'?'network_id':'container_id';if(p[field]!==null&&p[field]!==o.objectId)fail('PREVIEW_CONTAINER_IDENTITY_CHANGED');
   if(['START','STOP'].includes(i.kind)&&p.container_id!==o.objectId)fail('PREVIEW_CONTAINER_IDENTITY_CHANGED');
   if(i.kind==='NETWORK_CREATE')exec('UPDATE preview_container_profiles SET network_id=coalesce(network_id,?) WHERE reservation_id=?',o.objectId,i.reservationId);
   if(i.kind==='CREATE')exec('UPDATE preview_container_profiles SET container_id=coalesce(container_id,?) WHERE reservation_id=?',o.objectId,i.reservationId);
   exec("UPDATE preview_container_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE reservation_id=? AND kind=?",canonical(o),new Date().toISOString(),i.reservationId,i.kind);return view(profile(i.reservationId));
  });},
 };
}
