import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {canonical,releaseServiceClaim,releasePublicationProof} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import {releaseServiceMigration} from './release-service-migration.js';
import {releaseContinuationMigration} from './release-continuation-migration.js';
import {releaseServiceRequest,releaseServiceProfile,releaseServiceReservation,releaseServiceActionRequest,releaseServiceAction,releaseServiceNames,releaseServiceGateBinding} from './release-service.js';
import type {ReleaseServiceJournal,ReleaseServiceOriginal,ReleaseServiceFences,ReleaseServiceKind} from './release-service.js';
import type {StoreInput} from './store-protocol.js';
import type {RunnerCapacity,PreviewResourceLimits} from './preview-reservation.js';
import type {createReleaseRetirementDomain} from './release-retirement-domain.js';

type Row=Record<string,string|number|null>;
type Bound={controllerId:string;releaseId:string;requestHash:string};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
const now=()=>new Date().toISOString();
/** All state, source capacity retirement and observations share the Runner writer. */
export function createReleaseServiceDomain(db:DatabaseSync,runnerId:string,retirements:Pick<ReturnType<typeof createReleaseRetirementDomain>,'releaseRetirementGet'>,fits:(l:PreviewResourceLimits,c:RunnerCapacity)=>boolean){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const tx=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const v=body();db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}};
 const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);
 if(version===10)tx(()=>{db.exec(releaseServiceMigration);exec('INSERT INTO runner_schema_history VALUES(11,?,?)',hash(releaseServiceMigration),now());if(db.prepare('PRAGMA foreign_key_check').all().length)fail('RUNNER_MIGRATION_FOREIGN_KEYS');});else if(![11,12].includes(version))fail('RUNNER_STORE_IDENTITY_MISMATCH');
  if(Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0])===11)tx(()=>{db.exec(releaseContinuationMigration);exec('INSERT INTO runner_schema_history VALUES(12,?,?)',hash(releaseContinuationMigration),now());if(db.prepare('PRAGMA foreign_key_check').all().length)fail('RUNNER_MIGRATION_FOREIGN_KEYS');});
 if(get('SELECT sha256 FROM runner_schema_history WHERE version=11')?.sha256!==hash(releaseServiceMigration)||get('SELECT sha256 FROM runner_schema_history WHERE version=12')?.sha256!==hash(releaseContinuationMigration)||get('SELECT version FROM runner_identity')?.version!==12)fail('RUNNER_MIGRATION_DRIFT');
 if(Number(Object.values(db.prepare('PRAGMA foreign_keys').get()!)[0])!==1)fail('RUNNER_MIGRATION_FOREIGN_KEYS');
 const row=(i:Bound)=>{const r=get('SELECT * FROM release_service_handoffs WHERE release_id=? AND controller_id=?',i.releaseId,i.controllerId)??fail('RELEASE_SERVICE_NOT_FOUND',404);if(r.request_hash!==i.requestHash)fail('RELEASE_SERVICE_IDENTITY_CHANGED');return r;};
 const reservation=(id:string)=>get('SELECT * FROM release_service_reservations WHERE release_id=?',id);
 const profile=(id:string)=>get('SELECT * FROM release_service_profiles WHERE release_id=?',id);
 const action=(id:string,kind:string)=>get('SELECT * FROM release_service_actions WHERE release_id=? AND kind=?',id,kind);
 const seen=(id:string,kind:string)=>action(id,kind)?.state==='OBSERVED';
 const actionView=(a:Row)=>releaseServiceAction.parse({request:JSON.parse(String(a.request_json)),requestHash:a.request_hash,state:a.state,observation:a.observation_json?JSON.parse(String(a.observation_json)):null,createdAt:a.created_at,observedAt:a.observed_at});
 function rview(r:Row){const h=get('SELECT limits_json FROM release_service_handoffs WHERE release_id=?',r.release_id!)!;return releaseServiceReservation.parse({purpose:'RELEASE',releaseId:r.release_id,reservationId:r.reservation_id,controllerId:r.controller_id,requestHash:r.request_hash,resourceLimits:JSON.parse(String(h.limits_json)),state:r.state,revision:r.revision,instanceId:r.instance_id,endpoint:r.endpoint_json?JSON.parse(String(r.endpoint_json)):null,fact:r.fact_json?JSON.parse(String(r.fact_json)):null,claim:r.claim_json?JSON.parse(String(r.claim_json)):null,claimHash:r.claim_hash,createdAt:r.created_at,updatedAt:r.updated_at,releasedAt:r.released_at});}
 function original(id:string):ReleaseServiceOriginal{
  const h=get('SELECT * FROM release_service_handoffs WHERE release_id=?',id)??fail('RELEASE_SOURCE_UNAVAILABLE'),r=reservation(id),p=profile(id),proof=get('SELECT * FROM release_service_proofs WHERE release_id=?',id);
  if(!r||!p||!p.network_id||!p.container_id||!r.claim_hash||!proof)throw new RunnerError('RELEASE_SOURCE_UNAVAILABLE',409);
  return {request:releaseServiceRequest.parse(JSON.parse(String(h.request_json))),requestHash:String(h.request_hash),reservation:rview(r),profile:releaseServiceProfile.parse(JSON.parse(String(p.profile_json))),profileHash:String(p.profile_hash),networkId:String(p.network_id),containerId:String(p.container_id),proof:releasePublicationProof.parse(JSON.parse(String(proof.proof_json)))};
 }
 function view(h:Row):ReleaseServiceJournal{
  const q=releaseServiceRequest.parse(JSON.parse(String(h.request_json))),id=String(h.release_id),p=profile(id),r=reservation(id),proof=get('SELECT * FROM release_service_proofs WHERE release_id=?',id),retirement=retirements.releaseRetirementGet({controllerId:String(h.controller_id),releaseId:id,requestHash:q.retirementRequestHash});
  return {sequence:Number(h.sequence),controllerId:String(h.controller_id),request:q,requestHash:String(h.request_hash),retirement,source:h.source_release_id?original(String(h.source_release_id)):null,profilePreparation:p?String(get('SELECT mode FROM release_profile_preparations WHERE release_id=?',id)?.mode) as 'EXECUTE_ONCE'|'INSPECT_ONLY':null,reservation:r?rview(r):null,profile:p?releaseServiceProfile.parse(JSON.parse(String(p.profile_json))):null,profileHash:p?String(p.profile_hash):null,networkId:p?.network_id as string|null??null,containerId:p?.container_id as string|null??null,actions:all('SELECT * FROM release_service_actions WHERE release_id=? ORDER BY created_at,kind',id).map(actionView),proof:proof?releasePublicationProof.parse(JSON.parse(String(proof.proof_json))):null,proofHash:proof?String(proof.proof_hash):null,createdAt:String(h.created_at)};
 }
 const event=(r:Row)=>exec('INSERT INTO release_service_events VALUES(?,?,?,?)',r.release_id!,Number(r.revision),canonical(rview(r)),r.updated_at!);
 const changed=(id:string)=>{const r=reservation(id)!;event(r);return rview(r);};
 function fences(id:string):ReleaseServiceFences{
  const a=action(id,'ARM_FENCES');if(a?.state!=='OBSERVED')fail('RELEASE_SERVICE_PREDECESSOR_UNKNOWN');const o=actionView(a!).observation;if(o?.kind!=='ARM_FENCES')throw new RunnerError('RELEASE_SERVICE_FENCES_UNVERIFIED',409);return o.proof;
 }
 function readySource(h:Row){fences(String(h.release_id));if(h.source_release_id!==null&&!seen(String(h.release_id),'SOURCE_NETWORK_REMOVE'))fail('RELEASE_SERVICE_SOURCE_NOT_CLEARED');}
 function live(h:Row){const r=reservation(String(h.release_id))??fail('RELEASE_SERVICE_NOT_RESERVED');if(r.released_at!==null||get('SELECT 1 FROM release_service_handoffs WHERE source_release_id=?',h.release_id!))fail('RELEASE_SERVICE_EXECUTION_CLOSED');return r;}
 function healthy(h:Row){const r=live(h),v=rview(r),age=v.fact?Date.now()-Date.parse(v.fact.checkedAt):-1;if(v.state!=='ACTIVE'||v.fact?.state!=='HEALTHY'||!v.endpoint||!v.instanceId||age<0||age>30_000)fail('RELEASE_SERVICE_HEALTH_UNAVAILABLE');return v;}
 function eligible(i:Bound,kind:ReleaseServiceKind){
  const h=row(i),id=i.releaseId;if(kind==='ARM_FENCES')return h;fences(id);
  if(kind.startsWith('SOURCE_')){
   if(h.source_release_id===null)fail('RELEASE_SERVICE_SOURCE_NOT_APPLICABLE');original(String(h.source_release_id));
   if(kind==='SOURCE_CONTAINER_REMOVE'&&!seen(id,'SOURCE_STOP')||kind==='SOURCE_NETWORK_REMOVE'&&!seen(id,'SOURCE_CONTAINER_REMOVE'))fail('RELEASE_SERVICE_PREDECESSOR_UNKNOWN');return h;
  }
  readySource(h);live(h);if(!profile(id))fail('RELEASE_SERVICE_PROFILE_UNAVAILABLE');
  const previous:Partial<Record<ReleaseServiceKind,ReleaseServiceKind>>={GUARD_ENFORCE:'PROFILE_PREPARE',NETWORK_CREATE:'GUARD_ENFORCE',CREATE:'NETWORK_CREATE',START:'CREATE',ROUTE_BIND:'START'};
  if(previous[kind]&&!seen(id,previous[kind]!))fail('RELEASE_SERVICE_PREDECESSOR_UNKNOWN');
  if(kind==='ROUTE_BIND'&&!healthy(h).claimHash)fail('RELEASE_SERVICE_CLAIM_UNAVAILABLE');return h;
 }
 const follows=(n:{fenceId:string;generation:number;previousHoldHash:string},p:{fenceId:string;generation:number;proofHash:string})=>n.fenceId===p.fenceId&&n.generation>p.generation&&n.previousHoldHash===p.proofHash;
 return {
  releaseServiceEnroll(i:StoreInput<'releaseServiceEnroll'>){return tx(()=>{
   const request=i.request,q=request.promotion.preparation;
   if(q.runnerId!==runnerId||i.requestHash!==hash(request))fail('RELEASE_SERVICE_IDENTITY_CHANGED');
   const old=get('SELECT * FROM release_service_handoffs WHERE release_id=?',q.releaseId);if(old){if(old.controller_id!==i.controllerId||old.request_hash!==i.requestHash||old.request_json!==canonical(request)||old.limits_json!==canonical(i.resourceLimits))fail('RELEASE_SERVICE_IDENTITY_CHANGED');return {dispatch:false,journal:view(old)};}
   const retirement=retirements.releaseRetirementGet({controllerId:i.controllerId,releaseId:q.releaseId,requestHash:request.retirementRequestHash});
    if(q.source&&get('SELECT 1 FROM release_service_handoffs WHERE source_release_id=?',q.source.releaseId))fail('RELEASE_SERVICE_SOURCE_ALREADY_RETIRING');
   if(!retirement.networkCleared||!retirement.containerCleared||!retirement.revoked||canonical(retirement.request.promotion)!==canonical(request.promotion)||retirement.request.promotionRequestHash!==request.promotionRequestHash||canonical(retirement.request.gates)!==canonical(request.gates))fail('RELEASE_SERVICE_RETIREMENT_UNVERIFIED');
   if(q.source){const s=original(q.source.releaseId),oldq=s.request.promotion.preparation;if(s.reservation.controllerId!==i.controllerId||oldq.projectId!==q.projectId||oldq.target.datasetId!==q.source.datasetId||oldq.operationId!==q.source.datasetOperationId||oldq.target.storageKey!==q.source.storageKey||s.proof.routeHash!==request.gates.previousRoute?.routeHash||s.proof.route.generation!==request.gates.previousRoute?.generation||s.proof.releaseId!==q.source.releaseId||canonical(s.proof.service.claim)!==canonical(s.reservation.claim))fail('RELEASE_SERVICE_SOURCE_CHANGED');}
   exec('INSERT INTO release_service_handoffs(release_id,controller_id,request_hash,request_json,limits_json,source_release_id,created_at) VALUES(?,?,?,?,?,?,?)',q.releaseId,i.controllerId,i.requestHash,canonical(request),canonical(i.resourceLimits),q.source?.releaseId??null,now());
   return {dispatch:true,journal:view(row({controllerId:i.controllerId,releaseId:q.releaseId,requestHash:i.requestHash}))};
  });},
  releaseServiceGet(i:StoreInput<'releaseServiceGet'>){return view(row(i));},
  releaseServicePage(i:StoreInput<'releaseServicePage'>){const rows=all('SELECT * FROM release_service_handoffs h WHERE controller_id=? AND sequence>? AND NOT EXISTS(SELECT 1 FROM release_service_proofs p WHERE p.release_id=h.release_id) ORDER BY sequence LIMIT ?',i.controllerId,i.afterSequence??0,(i.limit??20)+1),page=rows.slice(0,i.limit??20);return {items:page.map(view),nextSequence:rows.length>page.length?Number(page.at(-1)!.sequence):null};},
  releaseServiceReserve(i:StoreInput<'releaseServiceReserve'>){return tx(()=>{
   const h=row(i),old=reservation(i.releaseId);if(old)return view(h);readySource(h);const limits=JSON.parse(String(h.limits_json)) as PreviewResourceLimits;if(!fits(limits,i.capacity))fail('RUNNER_CAPACITY_EXHAUSTED',429);
   const q=JSON.parse(String(h.request_json)).promotion.preparation,at=now(),id='release_service_'+randomUUID().replaceAll('-','');
   exec("INSERT INTO release_service_reservations(release_id,reservation_id,controller_id,dataset_id,request_hash,state,revision,created_at,updated_at) VALUES(?,?,?,?,?,'RESERVED',0,?,?)",i.releaseId,id,i.controllerId,q.target.datasetId,i.requestHash,at,at);changed(i.releaseId);return view(h);
  });},
  releaseServiceProfilePrepare(i:StoreInput<'releaseServiceProfilePrepare'>){return tx(()=>{
   const h=row(i),v=view(h),r=v.reservation??fail('RELEASE_SERVICE_NOT_RESERVED'),p=i.profile,old=profile(i.releaseId),names=releaseServiceNames(r.reservationId),f=fences(i.releaseId);
   if(p.reservationId!==r.reservationId||p.requestHash!==i.requestHash||p.datasetDirectory!==v.retirement.original.profile.datasetDirectory||p.datasetBytes!==v.retirement.original.profile.datasetBytes||canonical(p.resourceLimits)!==canonical(r.resourceLimits)||p.networkName!==names.networkName||p.containerName!==names.containerName||p.fenceProofHash!==f.target.proofHash||p.gateBindingHash!==releaseServiceGateBinding(v.request))fail('RELEASE_SERVICE_PROFILE_CHANGED');
   if(old){if(old.profile_json!==canonical(p))fail('RELEASE_SERVICE_PROFILE_CHANGED');return v;}live(h);if(r.state!=='RESERVED')fail('RELEASE_SERVICE_ALREADY_DISPATCHED');
   exec('INSERT INTO release_service_profiles VALUES(?,?,?,NULL,NULL,?)',i.releaseId,hash(p),canonical(p),now());exec("INSERT INTO release_profile_preparations VALUES(?,'EXECUTE_ONCE')",i.releaseId);return view(h);
  });},
  releaseServiceActionBegin(i:StoreInput<'releaseServiceActionBegin'>){return tx(()=>{
   const h=row(i),old=action(i.releaseId,i.kind);if(old)return {dispatch:false,action:actionView(old)};eligible(i,i.kind);const v=view(h),source=i.kind.startsWith('SOURCE_')?v.source:null,r=source?.reservation??v.reservation;
   const request=releaseServiceActionRequest.parse({schemaVersion:'devmesh.release-service-action.v1',operationId:'op_'+hash('release-service:'+i.releaseId+':'+i.kind).slice(0,32),releaseId:i.releaseId,serviceRequestHash:i.requestHash,kind:i.kind,reservationId:i.kind==='ARM_FENCES'?null:r?.reservationId??null,profileHash:i.kind==='ARM_FENCES'?null:source?.profileHash??v.profileHash,containerId:i.kind==='ARM_FENCES'?null:source?.containerId??v.containerId,networkId:i.kind==='ARM_FENCES'?null:source?.networkId??v.networkId});
   exec("INSERT INTO release_service_actions VALUES(?,?,?,?,'SENT',NULL,?,NULL)",i.releaseId,i.kind,hash(request),canonical(request),now());
   if(i.kind==='GUARD_ENFORCE'){exec("UPDATE release_service_reservations SET state='DISPATCHED',revision=revision+1,updated_at=? WHERE release_id=?",now(),i.releaseId);changed(i.releaseId);}
   return {dispatch:true,action:actionView(action(i.releaseId,i.kind)!)};
  });},
  releaseServiceActionAuthorized(i:StoreInput<'releaseServiceActionAuthorized'>){row(i);const a=action(i.releaseId,i.kind);try{eligible(i,i.kind);return {allowed:a?.state==='SENT'&&a.request_hash===i.actionRequestHash&&(i.kind!=='PROFILE_PREPARE'||get('SELECT mode FROM release_profile_preparations WHERE release_id=?',i.releaseId)?.mode==='EXECUTE_ONCE')};}catch(e){if(e instanceof RunnerError)return {allowed:false};throw e;}},
  releaseServiceActionObserve(i:StoreInput<'releaseServiceActionObserve'>){return tx(()=>{
   const h=row(i),old=action(i.releaseId,i.kind)??fail('RELEASE_SERVICE_ACTION_NOT_FOUND',404),o=i.observation;
   if(old.request_hash!==i.actionRequestHash||o.kind!==i.kind)fail('RELEASE_SERVICE_IDENTITY_CHANGED');
   if(old.state==='OBSERVED'){if(old.observation_json!==canonical(o))fail('RELEASE_SERVICE_ACTION_IMMUTABLE');return view(h);}eligible(i,i.kind);
   if(Date.parse(o.checkedAt)<Date.parse(String(old.created_at))||Date.parse(o.checkedAt)>Date.now())fail('RELEASE_SERVICE_OBSERVATION_STALE');
   const v=view(h),q=v.request.promotion.preparation,a=actionView(old).request;
   if(o.kind==='ARM_FENCES'){
    const f=o.proof,p=v.request.promotion.preparedProof,revoke=v.retirement.actions.find(x=>x.observation?.kind==='REVOKE_PREPARATION')?.observation;
    if(revoke?.kind!=='REVOKE_PREPARATION'||f.releaseId!==q.releaseId||f.promotionRequestHash!==v.request.promotionRequestHash||f.retirementRequestHash!==v.request.retirementRequestHash||f.revocationProofHash!==revoke.proof.proofHash||f.target.datasetId!==q.target.datasetId||!follows(f.target,p.targetFence.physical))fail('RELEASE_SERVICE_FENCES_CHANGED');
    if(q.source){if(!f.source||!p.sourceFence||f.source.releaseId!==q.source.releaseId||f.source.datasetId!==q.source.datasetId||f.source.datasetOperationId!==q.source.datasetOperationId||!follows(f.source,p.sourceFence.physical))fail('RELEASE_SERVICE_FENCES_CHANGED');}else if(f.source!==null)fail('RELEASE_SERVICE_FENCES_CHANGED');
   }else if(o.kind==='PROFILE_PREPARE'){
     if(o.profileHash!==v.profileHash)fail('RELEASE_SERVICE_PROFILE_CHANGED');
    }else if(o.kind==='GUARD_ENFORCE'){
    const g=o.proof,r=v.reservation!,p=v.profile!;if(g.releaseId!==q.releaseId||g.runnerId!==runnerId||g.controllerId!==i.controllerId||g.serviceRequestHash!==i.requestHash||g.reservationId!==r.reservationId||g.profileHash!==v.profileHash||g.datasetId!==q.target.datasetId||g.targetProofHash!==p.fenceProofHash||g.gateBindingHash!==p.gateBindingHash)fail('RELEASE_SERVICE_GUARD_CHANGED');
   }else if(o.kind==='ROUTE_BIND'){
    const r=o.route,c=v.reservation!.claim;if(!c||r.routeId!=='release.'+q.projectId||r.projectId!==q.projectId||r.releaseId!==q.releaseId||r.previousReleaseId!==q.expectedAcceptedReleaseId||r.generation!==(v.request.gates.previousRoute?.generation??0)+1||r.datasetId!==q.target.datasetId||r.imageDigest!==q.image.imageDigest||r.instanceId!==c.instanceId||r.serviceClaimHash!==v.reservation!.claimHash||canonical(r.endpoint)!==canonical(v.reservation!.endpoint)||o.routeHash!==hash(r))fail('RELEASE_SERVICE_ROUTE_CHANGED');
   }else{
    if(o.kind.startsWith('SOURCE_')){if(o.objectId!==(o.kind==='SOURCE_NETWORK_REMOVE'?a.networkId:a.containerId)||o.kind==='SOURCE_STOP'&&(!('state' in o)||!['CREATED','EXITED'].includes(o.state)))fail('RELEASE_SERVICE_SOURCE_CHANGED');}
    else{
     const p=profile(i.releaseId)!;if(o.kind==='NETWORK_CREATE'&&('state' in o&&o.state!=='CREATED'||p.network_id!==null&&p.network_id!==o.objectId||o.objectId===v.retirement.original.networkId||o.objectId===v.source?.networkId)||o.kind==='CREATE'&&('state' in o&&o.state!=='CREATED'||p.container_id!==null&&p.container_id!==o.objectId||o.objectId===v.retirement.original.containerId||o.objectId===v.source?.containerId)||o.kind==='START'&&(!('state' in o)||o.state==='CREATED'||p.container_id!==o.objectId))fail('RELEASE_SERVICE_OBJECT_CHANGED');
     if(o.kind==='NETWORK_CREATE'||o.kind==='CREATE')exec('UPDATE release_service_profiles SET '+(o.kind==='NETWORK_CREATE'?'network_id':'container_id')+'=? WHERE release_id=?',o.objectId,i.releaseId);
    }
   }
   exec("UPDATE release_service_actions SET state='OBSERVED',observation_json=?,observed_at=? WHERE release_id=? AND kind=?",canonical(o),now(),i.releaseId,i.kind);
   if(i.kind==='SOURCE_CONTAINER_REMOVE'){
    const s=v.source!,r=reservation(s.request.promotion.preparation.releaseId)!;if(r.released_at===null){const at=now();exec("UPDATE release_service_reservations SET state='REMOVED',revision=revision+1,updated_at=?,released_at=? WHERE release_id=?",at,at,r.release_id!);changed(String(r.release_id));}
   }
   return view(h);
  });},
  releaseServiceRecord(i:StoreInput<'releaseServiceRecord'>){return tx(()=>{
   const h=row(i),r=reservation(i.releaseId)??fail('RELEASE_SERVICE_NOT_RESERVED'),v=view(h),q=v.request.promotion.preparation,f=i.fact;
   if(f.releaseId!==q.releaseId||f.datasetId!==q.target.datasetId||f.imageDigest!==q.image.imageDigest)fail('RELEASE_SERVICE_IDENTITY_CHANGED');if(r.fact_json===canonical(f))return v;
   live(h);if(i.expectedRevision!==r.revision)fail('RELEASE_SERVICE_REVISION_CHANGED');if(r.state==='RESERVED')fail('RELEASE_SERVICE_NOT_DISPATCHED');
   const p=profile(i.releaseId)!,at=Date.parse(f.checkedAt),previous=r.fact_json?JSON.parse(String(r.fact_json)):null;
   if(at>Date.now()||at<Date.parse(String(r.created_at))||previous&&at<Date.parse(previous.checkedAt))fail('RELEASE_SERVICE_OBSERVATION_STALE');
   if(f.instanceId!==null&&f.instanceId!==p.container_id||r.instance_id!==null&&f.instanceId!==null&&f.instanceId!==r.instance_id||r.endpoint_json!==null&&f.endpoint!==null&&canonical(f.endpoint)!==r.endpoint_json)fail('RELEASE_SERVICE_OBJECT_CHANGED');
   const started=action(i.releaseId,'START');if(f.state==='HEALTHY'&&(!started||started.state!=='OBSERVED'||JSON.parse(String(started.observation_json)).state!=='RUNNING'))fail('RELEASE_SERVICE_START_UNVERIFIED');
   const state=f.state==='EXITED'?'EXITED':f.state==='UNKNOWN'?'UNKNOWN':f.state==='CREATED'?'DISPATCHED':'ACTIVE',n=now();exec('UPDATE release_service_reservations SET state=?,revision=revision+1,instance_id=coalesce(instance_id,?),endpoint_json=coalesce(endpoint_json,?),fact_json=?,updated_at=?,released_at=? WHERE release_id=?',state,f.instanceId,f.endpoint?canonical(f.endpoint):null,canonical(f),n,state==='EXITED'?n:null,i.releaseId);changed(i.releaseId);return view(h);
  });},
  releaseServiceOwn(i:StoreInput<'releaseServiceOwn'>){return tx(()=>{
   const h=row(i),old=reservation(i.releaseId);if(old?.claim_hash)return view(h);const r=healthy(h),v=view(h),q=v.request.promotion.preparation,f=fences(i.releaseId).target;
   if(!seen(i.releaseId,'GUARD_ENFORCE')||!v.containerId||!v.networkId)fail('RELEASE_SERVICE_GUARD_UNVERIFIED');
   const claim=releaseServiceClaim.parse({schemaVersion:'devmesh.release-service-claim.v1',purpose:'RELEASE',releaseId:q.releaseId,projectId:q.projectId,runId:q.runId,candidateId:q.candidateId,acceptanceOperationId:v.request.promotion.acceptanceOperationId,preparationOperationId:q.operationId,promotionRequestHash:v.request.promotionRequestHash,preparedProofHash:v.request.promotion.proofHash,runnerId,datasetId:q.target.datasetId,imageDigest:q.image.imageDigest,reservationId:r.reservationId,profileHash:v.profileHash,serviceRequestHash:i.requestHash,instanceId:v.containerId,networkId:v.networkId,accessMode:'READ_WRITE',custodyState:'RELEASE_OWNED',writeAdmission:'CONTROL_GATE_FENCED',targetFence:Object.fromEntries(['fenceId','generation','proofHash','previousHoldHash'].map(k=>[k,f[k as keyof typeof f]]))});
   exec('UPDATE release_service_reservations SET claim_json=?,claim_hash=?,revision=revision+1,updated_at=? WHERE release_id=?',canonical(claim),hash(claim),now(),i.releaseId);changed(i.releaseId);return view(h);
  });},
  releaseServicePrepareProof(i:StoreInput<'releaseServicePrepareProof'>){return tx(()=>{
   const h=row(i),existing=get('SELECT * FROM release_service_proofs WHERE release_id=?',i.releaseId);if(existing)return view(h);const r=healthy(h),v=view(h),q=v.request.promotion.preparation,f=fences(i.releaseId),route=actionView(action(i.releaseId,'ROUTE_BIND')??fail('RELEASE_SERVICE_ROUTE_UNAVAILABLE')).observation,revocation=v.retirement.actions.find(a=>a.observation?.kind==='REVOKE_PREPARATION')?.observation,retired=v.retirement.actions.find(a=>a.observation?.kind==='NETWORK_REMOVE')?.observation;
    if(!r.claim||!r.claimHash||route?.kind!=='ROUTE_BIND'||!seen(i.releaseId,'ROUTE_BIND')||revocation?.kind!=='REVOKE_PREPARATION'||!retired)throw new RunnerError('RELEASE_SERVICE_PROOF_UNAVAILABLE',409);
   const old=v.retirement.reservation,j=v.retirement.original,proof=releasePublicationProof.parse({schemaVersion:'devmesh.release-published.v1',releaseId:i.releaseId,acceptanceOperationId:v.request.promotion.acceptanceOperationId,preparationOperationId:q.operationId,promotionRequestHash:v.request.promotionRequestHash,preparedProofHash:v.request.promotion.proofHash,controllerId:i.controllerId,runnerId,backendRef:q.backendRef,gates:v.request.gates,readonlyRetirement:{reservationId:old.reservationId,profileHash:j.profileHash,serviceRequestHash:j.profile.requestHash,instanceId:j.containerId,networkId:j.networkId,containerAbsent:true,networkAbsent:true,verifiedAt:retired!.checkedAt},revocation:Object.fromEntries(['barrierId','generation','proofHash','state'].map(k=>[k,revocation!.kind==='REVOKE_PREPARATION'?revocation!.proof[k as keyof typeof revocation.proof]:null])),target:f.target,source:f.source,service:{claim:r.claim,claimHash:r.claimHash,endpoint:r.endpoint},route:route!.kind==='ROUTE_BIND'?route!.route:null,routeHash:route!.kind==='ROUTE_BIND'?route!.routeHash:null,publishedAt:now()});
   exec('INSERT INTO release_service_proofs VALUES(?,?,?,?)',i.releaseId,hash(proof),canonical(proof),now());return view(h);
  });},
 };
}
