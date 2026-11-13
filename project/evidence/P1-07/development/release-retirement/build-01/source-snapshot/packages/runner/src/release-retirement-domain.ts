import {createHash} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {canonical} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {releaseRetirementMigration} from './release-retirement-migration.js';
import {releaseRetirementRequest,releaseRetirementActionRequest,releaseRetirementAction} from './release-retirement.js';
import type {ReleaseRetirement} from './release-retirement.js';
import type {StoreInput} from './store-protocol.js';
import type {createAcceptanceServiceDomain} from './acceptance-service-domain.js';

type Row=Record<string,string|number|null>;
type Bound={controllerId:string;releaseId:string;requestHash:string};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
const kinds=['REVOKE_PREPARATION','STOP','CONTAINER_REMOVE','NETWORK_REMOVE'] as const;
/** The same private SQLite writer releases capacity and records absence atomically. */
export function createReleaseRetirementDomain(db:DatabaseSync,runnerId:string,services:Pick<ReturnType<typeof createAcceptanceServiceDomain>,'acceptanceServiceGet'|'acceptanceServiceJournal'>){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
 const all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[];
 const exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const v=body();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
 const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);
 if(version===9)tx(()=>{db.exec(releaseRetirementMigration);exec('INSERT INTO runner_schema_history VALUES(10,?,?)',hash(releaseRetirementMigration),new Date().toISOString());if(db.prepare('PRAGMA foreign_key_check').all().length)fail('RUNNER_MIGRATION_FOREIGN_KEYS');});
 else if(version!==10)fail('RUNNER_STORE_IDENTITY_MISMATCH');
 if(get('SELECT sha256 FROM runner_schema_history WHERE version=10')?.sha256!==hash(releaseRetirementMigration)||get('SELECT version FROM runner_identity')?.version!==10)fail('RUNNER_MIGRATION_DRIFT');
 if(Number(Object.values(db.prepare('PRAGMA foreign_keys').get()!)[0])!==1)fail('RUNNER_MIGRATION_FOREIGN_KEYS');
 const row=(i:Bound)=>{const r=get('SELECT * FROM release_retirements WHERE release_id=? AND controller_id=?',i.releaseId,i.controllerId)??fail('RELEASE_RETIREMENT_NOT_FOUND',404);if(r.request_hash!==i.requestHash)fail('RELEASE_RETIREMENT_IDENTITY_CHANGED');return r;};
 const action=(id:string,kind:string)=>get('SELECT * FROM release_retirement_actions WHERE release_id=? AND kind=?',id,kind);
 const actionView=(a:Row)=>releaseRetirementAction.parse({request:JSON.parse(String(a.request_json)),requestHash:a.request_hash,state:a.state,observation:a.observation_json?JSON.parse(String(a.observation_json)):null,createdAt:a.created_at,observedAt:a.observed_at});
 function view(r:Row):ReleaseRetirement{
  const original=JSON.parse(String(r.original_json)) as ReleaseRetirement['original'];
  const reservation=services.acceptanceServiceGet({controllerId:String(r.controller_id),reservationId:String(r.reservation_id),requestHash:original.profile.requestHash});
  const actions=all('SELECT * FROM release_retirement_actions WHERE release_id=? ORDER BY created_at,kind',r.release_id!).map(actionView);
  return {sequence:Number(r.sequence),controllerId:String(r.controller_id),request:releaseRetirementRequest.parse(JSON.parse(String(r.request_json))),requestHash:String(r.request_hash),original,reservation,actions,revoked:actions.some(a=>a.request.kind==='REVOKE_PREPARATION'&&a.state==='OBSERVED'),containerCleared:actions.some(a=>a.request.kind==='CONTAINER_REMOVE'&&a.state==='OBSERVED'),networkCleared:actions.some(a=>a.request.kind==='NETWORK_REMOVE'&&a.state==='OBSERVED'),createdAt:String(r.created_at)};
 }
 function eligible(i:Bound,kind:string){
  const r=row(i),index=kinds.indexOf(kind as typeof kinds[number]);
  if(index>0&&action(i.releaseId,kinds[index-1]!)?.state!=='OBSERVED')fail('RELEASE_RETIREMENT_PREDECESSOR_UNKNOWN');
  return r;
 }
 return {
  releaseRetirementEnroll(i:StoreInput<'releaseRetirementEnroll'>){return tx(()=>{
   const p=i.request.promotion,q=p.preparation,proof=p.preparedProof,g=i.request.gates;
   if(q.runnerId!==runnerId||i.requestHash!==hash(i.request)||i.request.promotionRequestHash!==hash(p)||p.proofHash!==hash(proof))fail('RELEASE_RETIREMENT_IDENTITY_CHANGED');
   if(proof.service.claim.schemaVersion!=='devmesh.acceptance-service-claim.v1')fail('RELEASE_RETIREMENT_ORIGINAL_UNVERIFIED');
   const old=get('SELECT * FROM release_retirements WHERE release_id=?',q.releaseId);
   if(old){if(old.controller_id!==i.controllerId||old.request_hash!==i.requestHash||old.request_json!==canonical(i.request))fail('RELEASE_RETIREMENT_IDENTITY_CHANGED');return {dispatch:false,journal:view(old)};}
   if(get('SELECT 1 FROM acceptance_service_aborts WHERE operation_id=?',q.operationId))fail('ACCEPTANCE_ABORT_REQUESTED');
   if(g.targetGate.state!=='CLOSED'||g.targetGate.datasetId!==q.target.datasetId||g.targetGate.datasetOperationId!==q.operationId||g.targetGate.datasetRequestHash!==hash(q)||g.sourceGate?.state==='OPEN'||(q.source===null)!==(g.sourceGate===null)||(q.expectedAcceptedReleaseId===null)!==(g.previousRoute===null)||g.previousRoute&&g.previousRoute.releaseId!==q.expectedAcceptedReleaseId)fail('RELEASE_RETIREMENT_GATES_CHANGED');
   if(q.source&&(!g.sourceGate||g.sourceGate.datasetId!==q.source.datasetId||g.sourceGate.datasetOperationId!==q.source.datasetOperationId||g.sourceGate.closeOperationId!==q.operationId||g.sourceGate.closeRequestHash!==proof.sourceFence?.closeRequestHash))fail('RELEASE_RETIREMENT_GATES_CHANGED');
   const b={controllerId:i.controllerId,reservationId:proof.service.reservationId,requestHash:proof.service.claim.serviceRequestHash},r=services.acceptanceServiceGet(b),j=services.acceptanceServiceJournal(b),saved=get('SELECT * FROM acceptance_service_proofs WHERE reservation_id=?',b.reservationId);
   if(!j||!j.networkId||!j.containerId||r.state!=='ACTIVE'||r.releasedAt!==null||r.custodyState!=='RELEASE_HELD'||r.claimHash!==proof.service.claimHash||canonical(r.claim)!==canonical(proof.service.claim)||canonical(r.request.preparation)!==canonical(q)||r.request.acceptanceRequestHash!==hash(q)||j.profileHash!==proof.service.profileHash||j.profile.accessMode!=='READ_ONLY'||j.containerId!==proof.service.claim.instanceId||r.instanceId!==j.containerId||saved?.proof_hash!==p.proofHash||saved.proof_json!==canonical(proof)||!kinds.slice(1).every((_,n)=>j.actions.some(a=>a.request.kind===['NETWORK_CREATE','CREATE','START'][n]&&a.state==='OBSERVED')))fail('RELEASE_RETIREMENT_ORIGINAL_UNVERIFIED');
   exec('INSERT INTO release_retirements(release_id,controller_id,preparation_operation_id,reservation_id,dataset_id,request_hash,request_json,original_json,created_at) VALUES(?,?,?,?,?,?,?,?,?)',q.releaseId,i.controllerId,q.operationId,r.reservationId,q.target.datasetId,i.requestHash,canonical(i.request),canonical(j),new Date().toISOString());
   return {dispatch:true,journal:view(row({controllerId:i.controllerId,releaseId:q.releaseId,requestHash:i.requestHash}))};
  });},
  releaseRetirementGet(i:StoreInput<'releaseRetirementGet'>){return view(row(i));},
  releaseRetirementPage(i:StoreInput<'releaseRetirementPage'>){const rows=all("SELECT * FROM release_retirements r WHERE controller_id=? AND sequence>? AND NOT EXISTS(SELECT 1 FROM release_retirement_actions a WHERE a.release_id=r.release_id AND kind='NETWORK_REMOVE' AND state='OBSERVED') ORDER BY sequence LIMIT ?",i.controllerId,i.afterSequence??0,(i.limit??20)+1),page=rows.slice(0,i.limit??20);return {items:page.map(view),nextSequence:rows.length>page.length?Number(page.at(-1)!.sequence):null};},
  releaseRetirementActionBegin(i:StoreInput<'releaseRetirementActionBegin'>){return tx(()=>{
   const r=row(i),old=action(i.releaseId,i.kind);if(old)return {dispatch:false,action:actionView(old)};
   eligible(i,i.kind);const v=view(r),j=v.original,request=releaseRetirementActionRequest.parse({schemaVersion:'devmesh.release-retirement-action.v1',operationId:'op_'+hash('release-retirement:'+i.releaseId+':'+i.kind).slice(0,32),releaseId:i.releaseId,promotionRequestHash:v.request.promotionRequestHash,retirementRequestHash:i.requestHash,reservationId:v.reservation.reservationId,serviceRequestHash:j.profile.requestHash,profileHash:j.profileHash,networkId:j.networkId,containerId:j.containerId,kind:i.kind});
   exec("INSERT INTO release_retirement_actions VALUES(?,?,?,?,'SENT',NULL,?,NULL)",i.releaseId,i.kind,hash(request),canonical(request),new Date().toISOString());return {dispatch:true,action:actionView(action(i.releaseId,i.kind)!)};
  });},
  releaseRetirementActionAuthorized(i:StoreInput<'releaseRetirementActionAuthorized'>){row(i);const a=action(i.releaseId,i.kind);try{eligible(i,i.kind);return {allowed:a?.state==='SENT'&&a.request_hash===i.actionRequestHash};}catch(e){if(e instanceof RunnerError)return {allowed:false};throw e;}},
  releaseRetirementActionObserve(i:StoreInput<'releaseRetirementActionObserve'>){return tx(()=>{
   const r=eligible(i,i.kind),old=action(i.releaseId,i.kind)??fail('RELEASE_RETIREMENT_ACTION_NOT_FOUND',404),o=i.observation,v=view(r),j=v.original;
   if(old.request_hash!==i.actionRequestHash||o.kind!==i.kind)fail('RELEASE_RETIREMENT_IDENTITY_CHANGED');
   if(old.state==='OBSERVED'){if(old.observation_json!==canonical(o))fail('RELEASE_RETIREMENT_ACTION_IMMUTABLE');return v;}
   if(Date.parse(o.checkedAt)<Date.parse(String(old.created_at))||Date.parse(o.checkedAt)>Date.now())fail('RELEASE_RETIREMENT_OBSERVATION_STALE');
   if(o.kind==='REVOKE_PREPARATION'){
    const p=o.proof,q=v.request.promotion.preparation;
    if(p.promotionRequestHash!==v.request.promotionRequestHash||p.preparationOperationId!==q.operationId||p.releaseId!==i.releaseId||p.runnerId!==runnerId||p.controllerId!==i.controllerId)fail('RELEASE_RETIREMENT_REVOCATION_CHANGED');
   }else if(o.objectId!==(o.kind==='NETWORK_REMOVE'?j.networkId:j.containerId))fail('RELEASE_RETIREMENT_IDENTITY_CHANGED');
   const now=new Date().toISOString();exec("UPDATE release_retirement_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE release_id=? AND kind=?",canonical(o),now,i.releaseId,i.kind);
   if(i.kind==='CONTAINER_REMOVE'){
    exec("UPDATE acceptance_services SET state='REMOVED',revision=revision+1,updated_at=?,released_at=? WHERE reservation_id=?",now,now,v.reservation.reservationId);
    const current=services.acceptanceServiceGet({controllerId:i.controllerId,reservationId:v.reservation.reservationId,requestHash:j.profile.requestHash});
    exec('INSERT INTO acceptance_service_events VALUES(?,?,?,?)',current.reservationId,current.revision,canonical(current),now);
   }
   return view(r);
  });},
 };
}
