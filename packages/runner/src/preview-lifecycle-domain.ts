import {createHash} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {canonical,previewStopRequest} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {runnerPreviewLifecycle} from './preview-lifecycle.js';
import {PreviewClock} from './preview-clock.js';
import type {StoreInput} from './store-protocol.js';
const migration=`
ALTER TABLE runner_identity RENAME TO runner_identity_v4;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=5)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,5 FROM runner_identity_v4;
DROP TABLE runner_identity_v4;
CREATE TABLE preview_lifecycles(reservation_id TEXT PRIMARY KEY,request_hash TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('PREVIEW','STOPPING','RELEASE_HELD','RELEASE_OWNED')),revision INTEGER NOT NULL,expires_at TEXT NOT NULL,expired_at TEXT,last_wall_at TEXT NOT NULL,release_claim_json TEXT CHECK(release_claim_json IS NULL OR json_valid(release_claim_json)),release_claim_hash TEXT,expiry_request_json TEXT CHECK(expiry_request_json IS NULL OR json_valid(expiry_request_json)),expiry_request_hash TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,FOREIGN KEY(reservation_id,request_hash) REFERENCES preview_reservations(reservation_id,request_hash),CHECK((state IN ('RELEASE_HELD','RELEASE_OWNED'))=(release_claim_json IS NOT NULL)),CHECK((release_claim_json IS NULL)=(release_claim_hash IS NULL)),CHECK((expiry_request_json IS NULL)=(expiry_request_hash IS NULL)),CHECK(expiry_request_json IS NULL OR state='STOPPING')) STRICT;
CREATE TABLE preview_lifecycle_events(reservation_id TEXT NOT NULL REFERENCES preview_lifecycles(reservation_id),revision INTEGER NOT NULL,snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),created_at TEXT NOT NULL,PRIMARY KEY(reservation_id,revision)) STRICT;
CREATE TRIGGER immutable_preview_lifecycle BEFORE UPDATE ON preview_lifecycles WHEN NEW.reservation_id<>OLD.reservation_id OR NEW.request_hash<>OLD.request_hash OR NEW.expires_at<>OLD.expires_at OR NEW.created_at<>OLD.created_at OR NEW.last_wall_at<OLD.last_wall_at OR (OLD.expired_at IS NOT NULL AND NEW.expired_at IS NOT OLD.expired_at) OR (OLD.release_claim_json IS NOT NULL AND (NEW.release_claim_json IS NOT OLD.release_claim_json OR NEW.release_claim_hash IS NOT OLD.release_claim_hash)) OR (OLD.expiry_request_json IS NOT NULL AND (NEW.expiry_request_json IS NOT OLD.expiry_request_json OR NEW.expiry_request_hash IS NOT OLD.expiry_request_hash)) OR (NEW.state<>OLD.state AND NOT ((OLD.state='PREVIEW' AND NEW.state IN ('STOPPING','RELEASE_HELD')) OR (OLD.state='RELEASE_HELD' AND NEW.state='RELEASE_OWNED'))) BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_lifecycle BEFORE DELETE ON preview_lifecycles BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_IMMUTABLE'); END;
CREATE TRIGGER immutable_preview_lifecycle_event BEFORE UPDATE ON preview_lifecycle_events BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_EVENT_IMMUTABLE'); END;
CREATE TRIGGER preserve_preview_lifecycle_event BEFORE DELETE ON preview_lifecycle_events BEGIN SELECT RAISE(ABORT,'PREVIEW_LIFECYCLE_EVENT_IMMUTABLE'); END;
PRAGMA user_version=5;`;
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
type Row=Record<string,string|number|null>;
type Bound={controllerId:string;reservationId:string;requestHash:string};
export function createPreviewLifecycleDomain(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p),clock=new PreviewClock();
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const r=body();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
  const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);if(version===4)tx(()=>{db.exec(migration);exec('INSERT INTO runner_schema_history VALUES(5,?,?)',hash(migration),new Date().toISOString());});else if(![5,6,7].includes(version))fail('RUNNER_STORE_IDENTITY_MISMATCH');
 if(get('SELECT sha256 FROM runner_schema_history WHERE version=5')?.sha256!==hash(migration)||get('SELECT version FROM runner_identity WHERE singleton=1')?.version!==(version===4?5:version))fail('RUNNER_MIGRATION_DRIFT');
 const reservation=(i:Bound)=>{const r=get('SELECT * FROM preview_reservations WHERE reservation_id=? AND controller_id=?',i.reservationId,i.controllerId)??fail('PREVIEW_RESERVATION_NOT_FOUND',404);if(r.request_hash!==i.requestHash)fail('PREVIEW_RESERVATION_IDENTITY_MISMATCH');return r;};
 const row=(id:string)=>get('SELECT * FROM preview_lifecycles WHERE reservation_id=?',id);
 const view=(r:Row)=>runnerPreviewLifecycle.parse({reservationId:r.reservation_id,requestHash:r.request_hash,state:r.state,revision:r.revision,expiresAt:r.expires_at,expiredAt:r.expired_at,lastWallAt:r.last_wall_at,releaseClaim:r.release_claim_json?JSON.parse(String(r.release_claim_json)):null,releaseClaimHash:r.release_claim_hash,expiryRequest:r.expiry_request_json?JSON.parse(String(r.expiry_request_json)):null,expiryRequestHash:r.expiry_request_hash,createdAt:r.created_at,updatedAt:r.updated_at});
 const event=(id:string)=>{const r=row(id)!;exec('INSERT INTO preview_lifecycle_events VALUES(?,?,?,?)',id,Number(r.revision),canonical(view(r)),String(r.updated_at));return r;};
 const observeClock=(id:string)=>{const r=row(id);if(!r)return null;if(get('SELECT released_at FROM preview_reservations WHERE reservation_id=?',id)?.released_at!==null){clock.forget(id);return r;}const observation=clock.observe(id,String(r.expires_at),String(r.last_wall_at),r.expired_at!==null);if(observation.expired&&r.expired_at===null){exec('UPDATE preview_lifecycles SET expired_at=?,last_wall_at=?,revision=revision+1,updated_at=? WHERE reservation_id=?',observation.wallAt,observation.wallAt,observation.wallAt,id);return event(id);}if(observation.wallAt!==r.last_wall_at)exec('UPDATE preview_lifecycles SET last_wall_at=? WHERE reservation_id=?',observation.wallAt,id);return row(id)!;};
 const stop=(id:string)=>{const r=row(id)!;if(r.state==='PREVIEW'){const at=new Date().toISOString();exec("UPDATE preview_lifecycles SET state='STOPPING',revision=revision+1,updated_at=? WHERE reservation_id=?",at,id);return event(id);}if(r.state!=='STOPPING')fail('PREVIEW_OWNED_BY_RELEASE');return r;};
 function actionGuard(i:StoreInput<'previewContainerActionBegin'>){
  reservation(i);const life=observeClock(i.reservationId)??fail('PREVIEW_LIFECYCLE_NOT_ENROLLED');
  if(i.action.kind==='STOP')stop(i.reservationId);
  else if(life.state!=='PREVIEW'||life.expired_at!==null)fail(String(life.state).startsWith('RELEASE_')?'PREVIEW_OWNED_BY_RELEASE':'PREVIEW_EXPIRY_CLAIMED');
 }
 return {
  actionGuard,
  forgetClock:(id:string)=>clock.forget(id),
  previewLifecycleEnroll(i:StoreInput<'previewLifecycleEnroll'>){return tx(()=>{const r=reservation(i),old=row(i.reservationId);if(old)return view(observeClock(i.reservationId)!);if(r.state!=='RESERVED'||get('SELECT 1 FROM preview_container_actions WHERE reservation_id=?',i.reservationId))fail('PREVIEW_LIFECYCLE_ADOPTION_FORBIDDEN');const at=new Date().toISOString(),request=JSON.parse(String(r.request_json));exec("INSERT INTO preview_lifecycles VALUES(?,?,'PREVIEW',0,?,NULL,?,NULL,NULL,NULL,NULL,?,?)",i.reservationId,i.requestHash,request.expiresAt,at,at,at);return view(event(i.reservationId));});},
  previewLifecycleGet(i:StoreInput<'previewLifecycleGet'>){return tx(()=>{reservation(i);const r=observeClock(i.reservationId);return r?view(r):null;});},
  previewLifecycleActionAuthorized(i:StoreInput<'previewLifecycleActionAuthorized'>){return tx(()=>{const r=reservation(i),life=observeClock(i.reservationId),a=get('SELECT * FROM preview_container_actions WHERE reservation_id=? AND kind=?',i.reservationId,i.kind);return {allowed:!!life&&r.released_at===null&&a?.state==='SENT'&&a.request_hash===i.actionRequestHash&&(i.kind==='STOP'?life.state==='STOPPING':life.state==='PREVIEW'&&life.expired_at===null)};});},
  previewExpiryPrepare(i:StoreInput<'previewExpiryPrepare'>){return tx(()=>{
   const r=reservation(i);let life=observeClock(i.reservationId);if(!life||r.released_at!==null||String(life.state).startsWith('RELEASE_')||life.expired_at===null)return life?view(life):null;
   life=stop(i.reservationId);if(life.expiry_request_json!==null||get("SELECT 1 FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'",i.reservationId))return view(life);
   const p=get('SELECT container_id FROM preview_container_profiles WHERE reservation_id=?',i.reservationId);if(!p?.container_id||r.instance_id!==p.container_id)return view(life);
   const original=JSON.parse(String(r.request_json)),request=previewStopRequest.parse({schemaVersion:'devmesh.preview-stop.v1',operationId:'op_'+hash('runner-preview-expiry:'+i.reservationId).slice(0,32),projectId:original.projectId,runId:original.runId,candidateId:original.candidateId,policyHash:original.policyHash,backendRef:original.backendRef,runnerId:original.runnerId,previewId:original.previewId,datasetId:original.datasetId,imageDigest:original.imageDigest,startOperationId:original.operationId,startRequestHash:i.requestHash,instanceId:p.container_id,reason:'EXPIRED'}),at=new Date().toISOString();
   exec('UPDATE preview_lifecycles SET expiry_request_json=?,expiry_request_hash=?,revision=revision+1,updated_at=? WHERE reservation_id=?',canonical(request),hash(request),at,i.reservationId);return view(event(i.reservationId));
  });},
  previewExpiryAuthorized(i:StoreInput<'previewExpiryAuthorized'>){return tx(()=>{const r=reservation(i),life=observeClock(i.reservationId);return {allowed:!!life&&r.released_at===null&&life.state==='STOPPING'&&life.expired_at!==null&&life.expiry_request_hash===i.expiryRequestHash};});},
  previewReleaseHold(i:StoreInput<'previewReleaseHold'>){return tx(()=>{
   const r=reservation(i),life=observeClock(i.reservationId)??fail('PREVIEW_LIFECYCLE_NOT_ENROLLED'),claim=i.claim,original=JSON.parse(String(r.request_json)),claimHash=hash(claim);
   if(i.claimHash!==claimHash||claim.startRequestHash!==i.requestHash||claim.startOperationId!==original.operationId||claim.instanceId!==r.instance_id)fail('PREVIEW_RELEASE_CLAIM_CHANGED');for(const k of ['candidateId','manifestHash','previewId','datasetId','imageDigest'] as const)if(claim[k]!==original[k])fail('PREVIEW_RELEASE_CLAIM_CHANGED');
   if(life.release_claim_hash!==null){if(life.release_claim_hash!==claimHash||life.release_claim_json!==canonical(claim))fail('PREVIEW_RELEASE_CLAIM_CHANGED');return view(life);}
   const fact=r.fact_json?JSON.parse(String(r.fact_json)):null;if(life.state!=='PREVIEW'||life.expired_at!==null||r.released_at!==null||fact?.state!=='HEALTHY'||fact.instanceId!==claim.instanceId||Date.now()-Date.parse(fact.checkedAt)>30000||get("SELECT 1 FROM preview_container_actions WHERE reservation_id=? AND kind='STOP'",i.reservationId))fail('PREVIEW_RELEASE_HOLD_UNAVAILABLE');
   const at=new Date().toISOString();exec("UPDATE preview_lifecycles SET state='RELEASE_HELD',release_claim_json=?,release_claim_hash=?,revision=revision+1,updated_at=? WHERE reservation_id=?",canonical(claim),claimHash,at,i.reservationId);return view(event(i.reservationId));
  });},
  previewReleaseCommit(i:StoreInput<'previewReleaseCommit'>){return tx(()=>{reservation(i);const life=row(i.reservationId)??fail('PREVIEW_LIFECYCLE_NOT_ENROLLED');if(life.release_claim_hash!==i.claimHash||!['RELEASE_HELD','RELEASE_OWNED'].includes(String(life.state)))fail('PREVIEW_RELEASE_CLAIM_CHANGED');const claim=JSON.parse(String(life.release_claim_json));if(claim.releaseId!==i.releaseId||claim.operationId!==i.acceptanceOperationId||claim.acceptanceRequestHash!==i.acceptanceRequestHash)fail('PREVIEW_RELEASE_CLAIM_CHANGED');if(life.state==='RELEASE_OWNED')return view(life);const at=new Date().toISOString();exec("UPDATE preview_lifecycles SET state='RELEASE_OWNED',revision=revision+1,updated_at=? WHERE reservation_id=?",at,i.reservationId);return view(event(i.reservationId));});},
 };
}
