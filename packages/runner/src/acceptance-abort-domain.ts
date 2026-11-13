import {createHash} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {acceptanceAbortDecision,canonical} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {acceptanceAbortMigration} from './acceptance-abort-migration.js';
import {acceptanceAbortAction,acceptanceAbortActionRequest} from './acceptance-abort.js';
import type {AcceptanceServiceAbort} from './acceptance-abort.js';
import type {StoreInput} from './store-protocol.js';
import type {createAcceptanceServiceDomain} from './acceptance-service-domain.js';
type Row=Record<string,string|number|null>;
type Bound={controllerId:string;operationId:string;decisionHash:string};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
/** Private writer; a trusted adapter reads the original control decision. */
export function createAcceptanceAbortDomain(db:DatabaseSync,runnerId:string,services:Pick<ReturnType<typeof createAcceptanceServiceDomain>,'acceptanceServiceGet'|'acceptanceServiceJournal'>){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const v=body();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
 const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);
 if(version===8){db.exec('PRAGMA foreign_keys=OFF');try{if(Number(Object.values(db.prepare('PRAGMA foreign_keys').get()!)[0])!==0)fail('RUNNER_MIGRATION_FOREIGN_KEYS');tx(()=>{db.exec(acceptanceAbortMigration);exec('INSERT INTO runner_schema_history VALUES(9,?,?)',hash(acceptanceAbortMigration),new Date().toISOString());if(db.prepare('PRAGMA foreign_key_check').all().length)fail('RUNNER_MIGRATION_FOREIGN_KEYS');});}finally{db.exec('PRAGMA foreign_keys=ON');}}else if(version!==9)fail('RUNNER_STORE_IDENTITY_MISMATCH');
 if(get('SELECT sha256 FROM runner_schema_history WHERE version=9')?.sha256!==hash(acceptanceAbortMigration)||get('SELECT version FROM runner_identity')?.version!==9)fail('RUNNER_MIGRATION_DRIFT');
 if(Number(Object.values(db.prepare('PRAGMA foreign_keys').get()!)[0])!==1)fail('RUNNER_MIGRATION_FOREIGN_KEYS');
 const row=(i:Bound)=>{const r=get('SELECT * FROM acceptance_service_aborts WHERE operation_id=? AND controller_id=?',i.operationId,i.controllerId)??fail('ACCEPTANCE_ABORT_NOT_FOUND',404);if(r.decision_hash!==i.decisionHash)fail('ACCEPTANCE_ABORT_IDENTITY_CHANGED');return r;};
 const action=(id:string,kind:string)=>get('SELECT * FROM acceptance_abort_actions WHERE operation_id=? AND kind=?',id,kind);
 const actionView=(r:Row)=>acceptanceAbortAction.parse({request:JSON.parse(String(r.request_json)),requestHash:r.request_hash,state:r.state,observation:r.observation_json?JSON.parse(String(r.observation_json)):null,createdAt:r.created_at,observedAt:r.observed_at});
 function original(r:Row){if(r.reservation_id===null)return null;const s=get('SELECT request_hash FROM acceptance_services WHERE reservation_id=?',r.reservation_id!);return services.acceptanceServiceGet({controllerId:String(r.controller_id),reservationId:String(r.reservation_id),requestHash:String(s?.request_hash??fail('ACCEPTANCE_SERVICE_NOT_FOUND'))});}
 function view(r:Row):AcceptanceServiceAbort{
  const reservation=original(r),actions=all('SELECT * FROM acceptance_abort_actions WHERE operation_id=? ORDER BY created_at,kind',r.operation_id!).map(actionView),unsent=!reservation||reservation.state==='CANCELLED';
  return {controllerId:String(r.controller_id),record:{decision:acceptanceAbortDecision.parse(JSON.parse(String(r.decision_json))),decisionHash:String(r.decision_hash)},reservation,actions,serviceCleared:unsent||actions.some(a=>a.request.kind==='CONTAINER_REMOVE'&&a.state==='OBSERVED'),networkCleared:unsent||actions.some(a=>a.request.kind==='NETWORK_REMOVE'&&a.state==='OBSERVED')};
 }
 function eligible(i:Bound,kind:string){
  const a=row(i),r=original(a)??fail('ACCEPTANCE_ABORT_NO_SERVICE'),j=services.acceptanceServiceJournal({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash})??fail('ACCEPTANCE_ABORT_ORIGINAL_UNKNOWN');
  if(!j.networkId||!j.actions.some(a=>a.request.kind==='NETWORK_CREATE'&&a.state==='OBSERVED'))fail('ACCEPTANCE_ABORT_ORIGINAL_UNKNOWN');
  const created=j.actions.some(a=>a.request.kind==='CREATE');
  if(kind!=='NETWORK_REMOVE'&&(!j.containerId||!j.actions.some(a=>a.request.kind==='CREATE'&&a.state==='OBSERVED')))fail('ACCEPTANCE_ABORT_ORIGINAL_UNKNOWN');
  if(kind==='CONTAINER_REMOVE'&&action(i.operationId,'STOP')?.state!=='OBSERVED'||kind==='NETWORK_REMOVE'&&created&&action(i.operationId,'CONTAINER_REMOVE')?.state!=='OBSERVED')fail('ACCEPTANCE_ABORT_PREDECESSOR_UNKNOWN');
  return {a,r,j};
 }
 function release(r:NonNullable<ReturnType<typeof original>>,state:'CANCELLED'|'REMOVED',instanceId:string|null){
  if(r.releasedAt!==null)return;const at=new Date().toISOString();exec('UPDATE acceptance_services SET state=?,instance_id=coalesce(instance_id,?),revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?',state,instanceId,at,at,r.reservationId);
  const current=services.acceptanceServiceGet({controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});exec('INSERT INTO acceptance_service_events VALUES(?,?,?,?)',r.reservationId,current.revision,canonical(current),at);
 }
 return {
  acceptanceAbortEnroll(i:StoreInput<'acceptanceAbortEnroll'>){return tx(()=>{
   const d=i.decision,q=d.preparation;if(q.runnerId!==runnerId||i.decisionHash!==hash(d))fail('ACCEPTANCE_ABORT_IDENTITY_CHANGED');
   const old=get('SELECT * FROM acceptance_service_aborts WHERE operation_id=?',q.operationId);if(old){if(old.controller_id!==i.controllerId||old.decision_hash!==i.decisionHash||old.decision_json!==canonical(d))fail('ACCEPTANCE_ABORT_IDENTITY_CHANGED');return view(old);}
   if(get('SELECT 1 FROM acceptance_services WHERE operation_id=? AND controller_id<>?',q.operationId,i.controllerId))fail('ACCEPTANCE_ABORT_IDENTITY_CHANGED');
   const service=get('SELECT * FROM acceptance_services WHERE controller_id=? AND operation_id=?',i.controllerId,q.operationId);
   if(service){const r=JSON.parse(String(service.request_json));if(canonical(r.preparation)!==canonical(q)||r.acceptanceRequestHash!==d.preparationRequestHash)fail('ACCEPTANCE_ABORT_IDENTITY_CHANGED');if(d.preparedProofHash!==null&&get('SELECT proof_hash FROM acceptance_service_proofs WHERE reservation_id=?',service.reservation_id!)?.proof_hash!==d.preparedProofHash)fail('ACCEPTANCE_ABORT_PROOF_CHANGED');}
   else if(d.preparedProofHash!==null)fail('ACCEPTANCE_ABORT_PROOF_CHANGED');
   exec('INSERT INTO acceptance_service_aborts VALUES(?,?,?,?,?,?)',q.operationId,i.controllerId,service?.reservation_id??null,i.decisionHash,canonical(d),new Date().toISOString());
   const stored=row({controllerId:i.controllerId,operationId:q.operationId,decisionHash:i.decisionHash}),r=original(stored);if(r&&!get('SELECT 1 FROM acceptance_service_actions WHERE reservation_id=?',r.reservationId))release(r,'CANCELLED',null);return view(stored);
  });},
  acceptanceAbortGet(i:StoreInput<'acceptanceAbortGet'>){return view(row(i));},
  acceptanceAbortActionBegin(i:StoreInput<'acceptanceAbortActionBegin'>){return tx(()=>{
   row(i);const old=action(i.operationId,i.kind);if(old)return {dispatch:false,action:actionView(old)};const {a,r,j}=eligible(i,i.kind),decision=acceptanceAbortDecision.parse(JSON.parse(String(a.decision_json))),request=acceptanceAbortActionRequest.parse({schemaVersion:'devmesh.acceptance-service-abort-action.v1',operationId:'op_'+hash('acceptance-abort:'+i.operationId+':'+i.kind).slice(0,32),preparationOperationId:i.operationId,abortOperationId:decision.operationId,decisionHash:i.decisionHash,reservationId:r.reservationId,serviceRequestHash:r.requestHash,profileHash:j.profileHash,kind:i.kind,containerId:j.containerId,networkId:j.networkId});
   exec("INSERT INTO acceptance_abort_actions VALUES(?,?,?,?,?,'SENT',NULL,?,NULL)",i.operationId,i.kind,j.profileHash,hash(request),canonical(request),new Date().toISOString());return {dispatch:true,action:actionView(action(i.operationId,i.kind)!)};
  });},
  acceptanceAbortActionAuthorized(i:StoreInput<'acceptanceAbortActionAuthorized'>){row(i);const a=action(i.operationId,i.kind);try{eligible(i,i.kind);return {allowed:a?.state==='SENT'&&a.request_hash===i.actionRequestHash};}catch(e){if(e instanceof RunnerError)return {allowed:false};throw e;}},
  acceptanceAbortActionObserve(i:StoreInput<'acceptanceAbortActionObserve'>){return tx(()=>{
   const {a,r,j}=eligible(i,i.kind),old=action(i.operationId,i.kind)??fail('ACCEPTANCE_ABORT_ACTION_NOT_FOUND',404),o=i.observation;
   if(old.request_hash!==i.actionRequestHash||o.kind!==i.kind||o.objectId!==(i.kind==='NETWORK_REMOVE'?j.networkId:j.containerId))fail('ACCEPTANCE_ABORT_IDENTITY_CHANGED');
   if(old.state==='OBSERVED'){if(old.observation_json!==canonical(o))fail('ACCEPTANCE_ABORT_ACTION_IMMUTABLE');return view(a);}
   if(Date.parse(o.checkedAt)<Date.parse(String(old.created_at))||Date.parse(o.checkedAt)>Date.now())fail('ACCEPTANCE_ABORT_OBSERVATION_STALE');
   exec("UPDATE acceptance_abort_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE operation_id=? AND kind=?",canonical(o),new Date().toISOString(),i.operationId,i.kind);
   if(i.kind==='CONTAINER_REMOVE')release(r,'REMOVED',j.containerId);else if(i.kind==='NETWORK_REMOVE'&&!j.actions.some(a=>a.request.kind==='CREATE'))release(r,'CANCELLED',null);return view(a);
  });},
 };
}
