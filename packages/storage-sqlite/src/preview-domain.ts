import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertResourceVersion,parseContract,ids,candidatePreviewWorkspace,previewDatasetManagement,previewManagement} from '@devmesh/contracts';
import type {Meta,OperationResult} from './protocol.js';
import type {createPlanDomain} from './plan-domain.js';
import type {createReleaseFreezeDomain} from './release-freeze-domain.js';
import {previewRequests,previewBackendPolicy} from './preview-protocol.js';
import type {PreviewMethod,PreviewInput,PreviewBackendPolicy,DatasetView,PreviewView,PreviewEffect,PreviewRuntimeFact,PreviewRuntimeObservation,PreviewLifecycle} from './preview-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
type Row=Record<string,string|number|null>;
interface Hooks {
 operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize:()=>void):OperationResult;
 changed(runId:string,operationId:string,target:{datasetId:string;state:DatasetView['state']}|{previewId:string;state:PreviewView['state']}):void;
}
const json=<T>(v:unknown):T=>JSON.parse(String(v)) as T;
const uid=(prefix:string)=>prefix+'_'+randomUUID().replaceAll('-','');
const now=()=>new Date().toISOString();
function fail(code:string,status=409):never{throw new StorageError(code,status,'Preview operations require the exact durable identity and trusted original backend evidence');}
export function createPreviewDomain(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>,freezes:Pick<ReturnType<typeof createReleaseFreezeDomain>,'getCandidate'>,hooks:Hooks){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 function authorized(principalId:string,runId:string,write=false){const r=plans.authorized(principalId,runId);if(write&&r.membership!=='owner')fail('FORBIDDEN',403);return r;}
 function member(principalId:string,projectId:string,write=false){const r=get('SELECT m.role FROM project_members m WHERE m.project_id=? AND m.principal_id=?',projectId,principalId);if(!r)fail('PREVIEW_NOT_FOUND',404);if(write&&r.role!=='owner')fail('FORBIDDEN',403);}
 const policy=(projectId:string,policyHash:string):PreviewBackendPolicy=>previewBackendPolicy.parse(json(get('SELECT policy_json FROM preview_backend_policies WHERE project_id=? AND policy_hash=?',projectId,policyHash)?.policy_json??fail('PREVIEW_BACKEND_NOT_CONFIGURED',503)));
 const dataset=(id:string)=>get('SELECT * FROM datasets WHERE dataset_id=?',id)??fail('PREVIEW_DATASET_NOT_FOUND',404);
 const preview=(id:string)=>get('SELECT * FROM previews WHERE preview_id=?',id)??fail('PREVIEW_NOT_FOUND',404);
 const effect=(id:string)=>get('SELECT * FROM preview_effects WHERE operation_id=?',id)??fail('PREVIEW_EFFECT_NOT_FOUND',404);
 const datasetView=(r:Row):DatasetView=>({datasetId:String(r.dataset_id),projectId:String(r.project_id),runId:String(r.run_id),candidateId:String(r.candidate_id),operationId:String(r.operation_id),policyHash:String(r.policy_hash),sourceDatasetId:r.source_dataset_id as string|null,sourceReleaseId:r.source_release_id as string|null,storageKey:String(r.storage_key),schemaRevision:String(r.schema_revision),state:r.state as DatasetView['state'],revision:Number(r.revision),snapshotAt:r.snapshot_at as string|null,retentionUntil:String(r.retention_until),createdAt:String(r.created_at)});
 const effectView=(r:Row):PreviewEffect=>({operationId:String(r.operation_id),projectId:String(r.project_id),runId:String(r.run_id),candidateId:String(r.candidate_id),datasetId:String(r.dataset_id),previewId:r.preview_id as string|null,policyHash:String(r.policy_hash),kind:r.kind as PreviewEffect['kind'],remoteKey:String(r.remote_key),requestHash:String(r.request_hash),request:json(r.request_json),state:r.state as PreviewEffect['state'],revision:Number(r.revision),receipt:r.receipt_json?json(r.receipt_json):null,errorCode:r.error_code as string|null,createdAt:String(r.created_at)});
 const accepted=(r:Row)=>!!get('SELECT 1 FROM releases WHERE project_id=? AND (candidate_id=? OR prepared_data_ref=?)',r.project_id!,r.candidate_id!,r.dataset_id!);
  const runtimeView=(r:Row):PreviewRuntimeObservation=>({sequence:Number(r.sequence),fact:json<PreviewRuntimeFact>(r.fact_json),observedAt:String(r.observed_at)});
  const latestRuntime=(previewId:string)=>{const r=get('SELECT * FROM preview_runtime_observations WHERE preview_id=? ORDER BY sequence DESC LIMIT 1',previewId);return r?runtimeView(r):null;};
 function previewView(r:Row):PreviewView {
   const d=dataset(String(r.dataset_id)),stop=get("SELECT operation_id FROM preview_effects WHERE preview_id=? AND kind='PREVIEW_STOP'",r.preview_id!),runtime=latestRuntime(String(r.preview_id));
  const basis={previewId:r.preview_id,previewRevision:r.revision,datasetId:r.dataset_id,datasetRevision:d.revision,imageDigest:r.image_digest,instanceId:r.instance_id,accepted:accepted(r)};
   const healthAge=runtime?Date.now()-Date.parse(runtime.fact.checkedAt):null;
   const fresh=runtime?.fact.state==='HEALTHY'&&runtime.fact.instanceId===r.instance_id&&healthAge!==null&&healthAge>=0&&healthAge<=30000;
   return {previewId:String(r.preview_id),projectId:String(r.project_id),runId:String(r.run_id),candidateId:String(r.candidate_id),operationId:String(r.operation_id),datasetId:String(r.dataset_id),policyHash:String(r.policy_hash),imageDigest:String(r.image_digest),state:r.state as PreviewView['state'],revision:Number(r.revision),instanceId:r.instance_id as string|null,expiresAt:String(r.expires_at),createdAt:String(r.created_at),impactReviewHash:digest(canonical(basis)),stopOperationId:stop?String(stop.operation_id):null,availability:r.state==='READY'&&String(r.expires_at)>now()&&d.state==='READY'&&fresh?'AVAILABLE':'UNAVAILABLE',healthState:runtime?.fact.state??'UNKNOWN',healthCheckedAt:runtime?.fact.checkedAt??null};
 }
 function scoped(principalId:string,runId:string,r:Row,write=false){const run=authorized(principalId,runId,write);if(r.run_id!==runId||r.project_id!==run.project_id)fail('PREVIEW_NOT_FOUND',404);return run;}
 function current(i:{meta:Meta;runId:string;candidateId:PreviewInput<'createPreviewDataset'>['candidateId'];manifestHash:string;ifMatch?:string|undefined}){
  const run=authorized(i.meta.principalId,i.runId,true);assertResourceVersion(i.ifMatch,Number(run.resource_revision));
  const c=freezes.getCandidate({principalId:i.meta.principalId,runId:ids.run.parse(i.runId),candidateId:i.candidateId});
  if(c.qualification!=='CURRENT'||c.manifestHash!==i.manifestHash||run.terminal_outcome!==null||run.control_gate!=='OPEN'||run.phase!=='REVIEW')fail('PREVIEW_CANDIDATE_STALE');return {run,c};
 }
 function backend(i:{principalId:string;operationId:string;requestHash?:string}){const e=effect(i.operationId),p=policy(String(e.project_id),String(e.policy_hash));if(p.backendPrincipalId!==i.principalId)fail('FORBIDDEN',403);if(i.requestHash!==undefined&&e.request_hash!==i.requestHash)fail('PREVIEW_REQUEST_CHANGED');return e;}
  function backendPreview(principalId:string,previewId:string){const p=preview(previewId);backend({principalId,operationId:String(p.operation_id)});return p;}
  function lifecycle(p:Row):PreviewLifecycle {const d=dataset(String(p.dataset_id)),stop=get("SELECT * FROM preview_effects WHERE preview_id=? AND kind='PREVIEW_STOP'",p.preview_id!);return {preview:previewView(p),startEffect:effectView(effect(String(p.operation_id))),datasetEffect:effectView(effect(String(d.operation_id))),stopEffect:stop?effectView(stop):null,runtime:latestRuntime(String(p.preview_id)),accepted:accepted(p)};}
  function dispatchAllowed(r:Row){
   if(r.kind==='PREVIEW_START'&&(String(preview(String(r.preview_id)).expires_at)<=now()||get("SELECT 1 FROM preview_effects WHERE preview_id=? AND kind='PREVIEW_STOP'",r.preview_id!)))fail('PREVIEW_EXPIRED_BEFORE_DISPATCH');
   if(r.kind!=='PREVIEW_STOP'){
    const owner=get('SELECT principal_id FROM operations WHERE operation_id=?',r.operation_id!)!,request=json<{manifestHash:string;sourceReleaseId?:string|null}>(r.request_json),run=authorized(String(owner.principal_id),String(r.run_id),true),c=freezes.getCandidate({principalId:String(owner.principal_id),runId:ids.run.parse(r.run_id),candidateId:ids.candidate.parse(r.candidate_id)});
    if(run.terminal_outcome!==null||run.control_gate!=='OPEN'||run.phase!=='REVIEW'||c.qualification!=='CURRENT'||c.manifestHash!==request.manifestHash)fail('PREVIEW_CANDIDATE_STALE');
    if(r.kind==='DATASET_PREPARE'&&(get('SELECT accepted_release_id FROM projects WHERE project_id=?',r.project_id!)!.accepted_release_id??null)!==(request.sourceReleaseId??null))fail('PREVIEW_SOURCE_RELEASE_CHANGED');
   }else if(accepted(preview(String(r.preview_id))))fail('PREVIEW_OWNED_BY_RELEASE');
  }
  function addStop(operationId:string,r:Row,reason:'USER'|'EXPIRED'){
   const v=previewView(r);if(accepted(r))fail('PREVIEW_OWNED_BY_RELEASE');
   if(!r.instance_id||!['READY','STARTING','UNKNOWN'].includes(String(r.state)))fail('PREVIEW_ORIGINAL_INSTANCE_UNKNOWN');
   if(reason==='EXPIRED'&&String(r.expires_at)>now())fail('PREVIEW_NOT_EXPIRED');
   if(v.stopOperationId)fail('PREVIEW_STOP_ALREADY_REQUESTED');
   const p=policy(v.projectId,v.policyHash),d=dataset(v.datasetId),start=effect(v.operationId);
   addEffect(operationId,d,'PREVIEW_STOP',v.previewId,{schemaVersion:'devmesh.preview-stop.v1',operationId,projectId:v.projectId,runId:v.runId,candidateId:v.candidateId,policyHash:v.policyHash,backendRef:p.backendRef,runnerId:p.runnerId,previewId:v.previewId,datasetId:v.datasetId,imageDigest:v.imageDigest,startOperationId:v.operationId,startRequestHash:start.request_hash,instanceId:v.instanceId,reason},v.previewId);
   exec("UPDATE previews SET state='STOPPING',revision=revision+1 WHERE preview_id=?",v.previewId);hooks.changed(v.runId,operationId,{previewId:v.previewId,state:'STOPPING'});return {previewId:v.previewId};
  }
 function known(runId:string){if(get("SELECT 1 FROM preview_effects WHERE run_id=? AND state IN ('PREPARED','SENT','UNKNOWN')",runId))fail('PREVIEW_ORIGINAL_EFFECT_UNRESOLVED');}
 function addEffect(operationId:string,r:Row,kind:PreviewEffect['kind'],remoteKey:string,request:Record<string,unknown>,previewId:string|null=null){
  const body=canonical(request);exec("INSERT INTO preview_effects VALUES(?,?,?,?,?,?,?,?,?,?,?,'PREPARED',1,NULL,NULL,?)",operationId,r.project_id!,r.run_id!,r.candidate_id!,r.dataset_id!,previewId,r.policy_hash!,kind,remoteKey,digest(body),body,now());
 }
 function operation(i:{meta:Meta;runId:string;ifMatch?:string|undefined},kind:string,payload:unknown,action:(id:string)=>Record<string,unknown>){if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);return hooks.operation(i.meta,kind,payload,action,()=>{authorized(i.meta.principalId,i.runId,true);});}
 function managementContext(i:{principalId:string;runId:PreviewInput<'createPreviewDataset'>['runId'];candidateId:PreviewInput<'createPreviewDataset'>['candidateId'];policyHash?:string|undefined}){
  const run=authorized(i.principalId,i.runId),c=freezes.getCandidate(i),data=c.manifest.delivery.record.dataPlan!,selected=i.policyHash?get('SELECT policy_json FROM preview_backend_policies WHERE project_id=? AND policy_hash=?',c.projectId,i.policyHash):undefined,p=selected?previewBackendPolicy.parse(json(selected.policy_json)):null,canManage=run.membership==='owner',pending=!!get("SELECT 1 FROM preview_effects WHERE run_id=? AND state IN ('PREPARED','SENT','UNKNOWN')",i.runId),current=canManage&&c.qualification==='CURRENT'&&run.terminal_outcome===null&&run.control_gate==='OPEN'&&run.phase==='REVIEW',source=get('SELECT accepted_release_id FROM projects WHERE project_id=?',c.projectId)!.accepted_release_id??null;
  const sourceData=data.sourceReleaseId?get('SELECT d.* FROM releases r JOIN datasets d ON d.dataset_id=r.prepared_data_ref WHERE r.project_id=? AND r.release_id=?',c.projectId,data.sourceReleaseId):null;
  const supported=p&&p.templateVersion===data.templateVersion&&(data.sourceReleaseId?Boolean(p.allowSnapshots&&sourceData&&['READY','WRITE_FROZEN'].includes(String(sourceData.state))&&sourceData.schema_revision===p.schemaRevision):data.strategy==='INITIAL'&&p.initialModes.includes(data.initialData));
  return {run,c,data,canManage,pending,configured:p!==null,policyHash:p?i.policyHash!:null,newAllowed:Boolean(current&&source===data.sourceReleaseId&&!pending),canCreateDataset:Boolean(current&&source===data.sourceReleaseId&&!pending&&supported)};
 }
 function managementDataset(r:Row,context:ReturnType<typeof managementContext>){const d=datasetView(r),e=effect(String(r.operation_id));return parseContract(previewDatasetManagement,{datasetId:d.datasetId,runId:d.runId,candidateId:d.candidateId,operationId:d.operationId,state:d.state,operationState:e.state,revision:d.revision,sourceDatasetId:d.sourceDatasetId,sourceReleaseId:d.sourceReleaseId,schemaRevision:d.schemaRevision,snapshotAt:d.snapshotAt,retentionUntil:d.retentionUntil,createdAt:d.createdAt,canStart:context.newAllowed&&context.configured&&context.policyHash===d.policyHash&&d.state==='READY'&&e.state==='SUCCEEDED'&&!get('SELECT 1 FROM previews WHERE dataset_id=?',d.datasetId)});}
 function managementPreview(r:Row,principalId:string,runId:string){const run=scoped(principalId,runId,r),p=previewView(r);return parseContract(previewManagement,{previewId:p.previewId,runId:p.runId,candidateId:p.candidateId,datasetId:p.datasetId,revision:p.revision,state:p.state,expiresAt:p.expiresAt,healthState:p.healthState,healthCheckedAt:p.healthCheckedAt,operationId:p.operationId,impactReviewHash:p.impactReviewHash,stopOperationId:p.stopOperationId,canStop:run.membership==='owner'&&!accepted(r)&&p.instanceId!==null&&['READY','STARTING','UNKNOWN'].includes(p.state)&&p.stopOperationId===null});}
 const handlers={
  getCandidatePreviewWorkspace(i:PreviewInput<'getCandidatePreviewWorkspace'>){
   const x=managementContext(i),page=(table:'datasets'|'previews',after:number)=>{const rows=all('SELECT rowid sequence,* FROM '+table+' WHERE run_id=? AND candidate_id=? AND rowid>? ORDER BY rowid LIMIT ?',i.runId,i.candidateId,after,i.limit+1),more=rows.length>i.limit;if(more)rows.pop();return {rows,next:more?Number(rows.at(-1)!.sequence):null};},d=page('datasets',i.afterDatasetSequence),p=page('previews',i.afterPreviewSequence);
   return parseContract(candidatePreviewWorkspace,{projectId:x.c.projectId,runId:i.runId,candidateId:i.candidateId,candidateRevision:x.c.revision,manifestHash:x.c.manifestHash,qualification:x.c.qualification,resourceRevision:Number(x.run.resource_revision),dataPlan:x.data,canManage:x.canManage,configured:x.configured,policyHash:x.policyHash,canCreateDataset:x.canCreateDataset,hasPendingEffects:x.pending,datasets:d.rows.map(r=>({sequence:Number(r.sequence),dataset:managementDataset(r,x)})),nextDatasetSequence:d.next,previews:p.rows.map(r=>({sequence:Number(r.sequence),preview:managementPreview(r,i.principalId,i.runId)})),nextPreviewSequence:p.next});
  },
  getCandidatePreviewDataset(i:PreviewInput<'getCandidatePreviewDataset'>){const x=managementContext(i),d=dataset(i.datasetId);scoped(i.principalId,i.runId,d);if(d.candidate_id!==i.candidateId)fail('PREVIEW_NOT_FOUND',404);return managementDataset(d,x);},
  getCandidatePreview(i:PreviewInput<'getCandidatePreview'>){freezes.getCandidate(i);const p=preview(i.previewId);if(p.candidate_id!==i.candidateId)fail('PREVIEW_NOT_FOUND',404);return managementPreview(p,i.principalId,i.runId);},
  registerPreviewBackendPolicy(i:PreviewInput<'registerPreviewBackendPolicy'>){return transaction(db,()=>{member(i.principalId,i.projectId,true);const body=canonical(i.policy),policyHash=digest(body);exec('INSERT OR IGNORE INTO preview_backend_policies VALUES(?,?,?,?,?)',i.projectId,policyHash,body,i.principalId,now());return {policyHash,policy:i.policy};});},
  getPreviewBackendPolicy(i:PreviewInput<'getPreviewBackendPolicy'>){member(i.principalId,i.projectId);return {policyHash:i.policyHash,policy:policy(i.projectId,i.policyHash)};},
  createPreviewDataset(i:PreviewInput<'createPreviewDataset'>){
   const {meta:_meta,ifMatch:_match,...payload}=i;const op=operation(i,'CreatePreviewDataset',payload,operationId=>{
    const {run,c}=current(i),p=policy(c.projectId,i.policyHash),data=c.manifest.delivery.record.dataPlan!;known(i.runId);
    if(p.templateVersion!==data.templateVersion)fail('PREVIEW_TEMPLATE_CHANGED');
    const project=get('SELECT accepted_release_id FROM projects WHERE project_id=?',c.projectId)!;
    if((project.accepted_release_id??null)!==data.sourceReleaseId)fail('PREVIEW_SOURCE_RELEASE_CHANGED');
    let sourceDatasetId:string|null=null;
    if(data.sourceReleaseId){
     const release=get('SELECT prepared_data_ref FROM releases WHERE project_id=? AND release_id=?',c.projectId,data.sourceReleaseId)??fail('PREVIEW_SOURCE_RELEASE_MISSING'),source=dataset(String(release.prepared_data_ref));
     if(source.project_id!==c.projectId||!['READY','WRITE_FROZEN'].includes(String(source.state)))fail('PREVIEW_SOURCE_DATASET_UNAVAILABLE');
     // Iteration preview always isolates the accepted data. Replacement is only
     // applied during a separately confirmed acceptance preparation.
     if(!p.allowSnapshots)fail('PREVIEW_SNAPSHOT_NOT_CONFIGURED',503);if(source.schema_revision!==p.schemaRevision)fail('PREVIEW_MIGRATION_NOT_CONFIGURED',503);sourceDatasetId=String(source.dataset_id);
    }else if(data.strategy!=='INITIAL'||!p.initialModes.includes(data.initialData))fail('PREVIEW_INITIAL_DATA_NOT_CONFIGURED',503);
    const datasetId=uid('dataset'),createdAt=now(),retentionUntil=new Date(Date.now()+p.retentionDays*86400000).toISOString(),storageKey=c.projectId+'/'+datasetId+'/app.sqlite';
    exec("INSERT INTO datasets VALUES(?,?,?,?,?,?,?,?,?,?,'PREPARING',1,NULL,?,?)",datasetId,c.projectId,i.runId,i.candidateId,operationId,i.policyHash,sourceDatasetId,data.sourceReleaseId,storageKey,p.schemaRevision,retentionUntil,createdAt);
    const d=dataset(datasetId);addEffect(operationId,d,'DATASET_PREPARE',datasetId,{schemaVersion:'devmesh.dataset-prepare.v1',operationId,projectId:c.projectId,runId:i.runId,candidateId:i.candidateId,manifestHash:c.manifestHash,policyHash:i.policyHash,backendRef:p.backendRef,runnerId:p.runnerId,datasetId,storageKey,schemaRevision:p.schemaRevision,sourceDatasetId,sourceStorageKey:sourceDatasetId?dataset(sourceDatasetId).storage_key:null,sourceReleaseId:data.sourceReleaseId,initialData:sourceDatasetId?null:data.initialData,templateVersion:p.templateVersion});
    hooks.changed(String(run.run_id),operationId,{datasetId,state:'PREPARING'});return {datasetId};
   });return datasetView(dataset(String(op.result!.datasetId)));
  },
  getPreviewDataset(i:PreviewInput<'getPreviewDataset'>){const d=dataset(i.datasetId);scoped(i.principalId,i.runId,d);return datasetView(d);},
  createPreviewIntent(i:PreviewInput<'createPreviewIntent'>){
   const {meta:_meta,ifMatch:_match,...payload}=i;const op=operation(i,'CreatePreviewIntent',payload,operationId=>{
    const {c}=current(i),d=dataset(i.datasetId);scoped(i.meta.principalId,i.runId,d,true);known(i.runId);
    if(d.candidate_id!==i.candidateId||d.state!=='READY'||effect(String(d.operation_id)).state!=='SUCCEEDED')fail('PREVIEW_DATASET_UNAVAILABLE');
    if(get('SELECT 1 FROM previews WHERE dataset_id=?',i.datasetId))fail('PREVIEW_DATASET_ALREADY_BOUND');
    const lifetime=Date.parse(i.expiresAt)-Date.now();if(lifetime<60000||lifetime>86400000)fail('PREVIEW_EXPIRY_INVALID',422);
    const p=policy(c.projectId,String(d.policy_hash)),previewId=uid('preview'),image=c.manifest.delivery.record.image!;
    exec("INSERT INTO previews VALUES(?,?,?,?,?,?,?,?,'STARTING',1,NULL,?,?)",previewId,c.projectId,i.runId,i.candidateId,operationId,i.datasetId,d.policy_hash!,image.imageDigest,i.expiresAt,now());
    addEffect(operationId,d,'PREVIEW_START',previewId,{schemaVersion:'devmesh.preview-start.v1',operationId,projectId:c.projectId,runId:i.runId,candidateId:i.candidateId,manifestHash:c.manifestHash,policyHash:d.policy_hash,backendRef:p.backendRef,runnerId:p.runnerId,previewId,datasetId:i.datasetId,storageKey:d.storage_key,datasetOperationId:d.operation_id,templateVersion:p.templateVersion,schemaRevision:p.schemaRevision,imageDigest:image.imageDigest,imageIdentity:image,expiresAt:i.expiresAt},previewId);
    hooks.changed(i.runId,operationId,{previewId,state:'STARTING'});return {previewId};
   });return previewView(preview(String(op.result!.previewId)));
  },
  getPreview(i:PreviewInput<'getPreview'>){const p=preview(i.previewId);scoped(i.principalId,i.runId,p);return previewView(p);},
   getPreviewLifecycle(i:PreviewInput<'getPreviewLifecycle'>){return lifecycle(backendPreview(i.principalId,i.previewId));},
    getPreviewLifecycleScope(i:PreviewInput<'getPreviewLifecycleScope'>){const p=policy(i.projectId,i.policyHash);if(p.backendPrincipalId!==i.principalId)fail('FORBIDDEN',403);return {policyHash:i.policyHash,policy:p};},
   listPreviewLifecycles(i:PreviewInput<'listPreviewLifecycles'>){
    if(policy(i.projectId,i.policyHash).backendPrincipalId!==i.principalId)fail('FORBIDDEN',403);
    const rows=all("SELECT rowid sequence,* FROM previews p WHERE project_id=? AND policy_hash=? AND rowid>? AND (state NOT IN ('STOPPED','EXPIRED') OR EXISTS(SELECT 1 FROM preview_effects e WHERE e.preview_id=p.preview_id AND e.state IN ('PREPARED','SENT','UNKNOWN'))) ORDER BY rowid LIMIT ?",i.projectId,i.policyHash,i.afterSequence,i.limit+1),more=rows.length>i.limit;if(more)rows.pop();return {items:rows.map(r=>({sequence:Number(r.sequence),lifecycle:lifecycle(r)})),nextSequence:more?Number(rows.at(-1)!.sequence):null};
   },
   verifyPreviewExecution(i:PreviewInput<'verifyPreviewExecution'>){
    const r=backend(i);if(!['SENT','UNKNOWN'].includes(String(r.state)))return {allowed:false,reasonCode:'PREVIEW_EFFECT_NOT_EXECUTABLE'};
    try{dispatchAllowed(r);return {allowed:true,reasonCode:null};}catch(error){if(error instanceof StorageError)return {allowed:false,reasonCode:error.code};throw error;}
   },
   recordPreviewRuntimeObservation(i:PreviewInput<'recordPreviewRuntimeObservation'>){return transaction(db,()=>{
    const start=backend(i),fact=i.fact;if(start.kind!=='PREVIEW_START'||start.state==='PREPARED')fail('PREVIEW_START_NOT_SENT');
    const p=preview(String(start.preview_id)),last=latestRuntime(String(p.preview_id)),body=canonical(fact);
    if(last&&canonical(last.fact)===body)return last;
    if((last?.sequence??0)!==i.expectedSequence)fail('PREVIEW_RUNTIME_REVISION_CHANGED');
    if(fact.previewId!==p.preview_id||fact.datasetId!==p.dataset_id||fact.imageDigest!==p.image_digest||p.instance_id!==null&&fact.instanceId!==null&&p.instance_id!==fact.instanceId)fail('PREVIEW_RUNTIME_IDENTITY_CHANGED');
    if(fact.checkedAt<String(start.created_at)||fact.checkedAt>now()||last&&fact.checkedAt<last.fact.checkedAt)fail('PREVIEW_RUNTIME_TIME_INVALID');
    if((start.state==='FAILED'||['STOPPED','EXPIRED'].includes(String(p.state)))&&!['EXITED','REMOVED','UNKNOWN'].includes(fact.state))fail('PREVIEW_RUNTIME_TERMINAL');
     if(!['REMOVED','UNKNOWN'].includes(fact.state)&&get("SELECT 1 FROM preview_runtime_observations WHERE preview_id=? AND json_extract(fact_json,'$.state')='REMOVED' LIMIT 1",p.preview_id!))fail('PREVIEW_RUNTIME_TERMINAL');
    const pinned=get("SELECT fact_json FROM preview_runtime_observations WHERE preview_id=? AND json_extract(fact_json,'$.endpoint') IS NOT NULL ORDER BY sequence LIMIT 1",p.preview_id!);
    if(pinned&&fact.endpoint!==null&&canonical(json<PreviewRuntimeFact>(pinned.fact_json).endpoint)!==canonical(fact.endpoint))fail('PREVIEW_RUNTIME_ENDPOINT_CHANGED');
    const stop=get("SELECT 1 FROM preview_effects WHERE preview_id=? AND kind='PREVIEW_STOP'",p.preview_id!);
    const next:PreviewView['state']=['STOPPED','EXPIRED'].includes(String(p.state))?p.state as PreviewView['state']:stop?'STOPPING':['EXITED','REMOVED'].includes(fact.state)?(String(p.expires_at)<=now()?'EXPIRED':'STOPPED'):fact.state==='HEALTHY'?(start.state==='SUCCEEDED'?'READY':'STARTING'):'UNKNOWN';
    const sequence=(last?.sequence??0)+1,observedAt=now();exec('INSERT INTO preview_runtime_observations VALUES(?,?,?,?,?,?,?)',p.preview_id!,sequence,start.operation_id!,start.request_hash!,body,fact.checkedAt,observedAt);
    if(next!==p.state||p.instance_id===null&&fact.instanceId!==null){exec('UPDATE previews SET state=?,instance_id=coalesce(instance_id,?),revision=revision+1 WHERE preview_id=?',next,fact.instanceId,p.preview_id!);hooks.changed(String(p.run_id),String(start.operation_id),{previewId:String(p.preview_id),state:next});}
    return {sequence,fact,observedAt};
   });},
   listPreviewRuntimeHistory(i:PreviewInput<'listPreviewRuntimeHistory'>){const e=backend(i);if(e.kind!=='PREVIEW_START')fail('PREVIEW_START_REQUIRED',422);const rows=all('SELECT * FROM preview_runtime_observations WHERE preview_id=? AND sequence>? ORDER BY sequence LIMIT ?',e.preview_id!,i.afterSequence,i.limit+1),more=rows.length>i.limit;if(more)rows.pop();return {items:rows.map(runtimeView),nextSequence:more?Number(rows.at(-1)!.sequence):null};},
   preparePreviewExpiry(i:PreviewInput<'preparePreviewExpiry'>){
    const p=backendPreview(i.principalId,i.previewId);if(accepted(p))fail('PREVIEW_OWNED_BY_RELEASE');if(String(p.expires_at)>now())fail('PREVIEW_NOT_EXPIRED');
    const old=get("SELECT operation_id FROM preview_effects WHERE preview_id=? AND kind='PREVIEW_STOP'",i.previewId);if(old)return previewView(p);
    const key=digest(i.previewId+':expiry'),idempotencyKey=key.slice(0,8)+'-'+key.slice(8,12)+'-4'+key.slice(13,16)+'-8'+key.slice(17,20)+'-'+key.slice(20,32),meta={principalId:i.principalId,scopeId:i.previewId,idempotencyKey};
    hooks.operation(meta,'ExpirePreview',{previewId:i.previewId},operationId=>addStop(operationId,backendPreview(i.principalId,i.previewId),'EXPIRED'),()=>{backendPreview(i.principalId,i.previewId);});return previewView(preview(i.previewId));
   },
  stopPreviewIntent(i:PreviewInput<'stopPreviewIntent'>){
   if(i.meta.scopeId!==i.previewId)fail('OPERATION_SCOPE_INVALID',422);const {meta:_meta,...payload}=i;
   const op=hooks.operation(i.meta,'StopPreviewIntent',payload,operationId=>{
    const r=preview(i.previewId);scoped(i.meta.principalId,i.runId,r,true);const v=previewView(r);
    if(v.revision!==i.previewRevision||v.impactReviewHash!==i.impactReviewHash)fail('PREVIEW_REVISION_CHANGED');
    return addStop(operationId,r,i.reason);
   },()=>{scoped(i.meta.principalId,i.runId,preview(i.previewId),true);});return previewView(preview(String(op.result!.previewId)));
  },
  getPreviewEffect(i:PreviewInput<'getPreviewEffect'>){return effectView(backend(i));},
  listPreviewEffects(i:PreviewInput<'listPreviewEffects'>){
   if(policy(i.projectId,i.policyHash).backendPrincipalId!==i.principalId)fail('FORBIDDEN',403);
   // Recovery scans restart at zero each cycle; this cursor pages retained
   // original rows, it is not a change stream for subsequent state updates.
   const rows=all('SELECT rowid sequence,* FROM preview_effects WHERE project_id=? AND policy_hash=? AND rowid>? AND state IN ('+i.states.map(()=>'?').join(',')+') ORDER BY rowid LIMIT ?',i.projectId,i.policyHash,i.afterSequence,...i.states,i.limit+1),more=rows.length>i.limit;if(more)rows.pop();
   return {items:rows.map(r=>({sequence:Number(r.sequence),effect:effectView(r)})),nextSequence:more?Number(rows.at(-1)!.sequence):null};
  },
  listPreviewDatasetWork(i:PreviewInput<'listPreviewDatasetWork'>){
   if(policy(i.projectId,i.policyHash).backendPrincipalId!==i.principalId)fail('FORBIDDEN',403);
   const rows=all("SELECT rowid sequence,* FROM preview_effects WHERE project_id=? AND policy_hash=? AND rowid>? AND kind='DATASET_PREPARE' AND state IN ('PREPARED','SENT','UNKNOWN') ORDER BY rowid LIMIT ?",i.projectId,i.policyHash,i.afterSequence,i.limit+1),more=rows.length>i.limit;if(more)rows.pop();
   return {items:rows.map(r=>({sequence:Number(r.sequence),effect:effectView(r)})),nextSequence:more?Number(rows.at(-1)!.sequence):null};
  },
  markPreviewEffectSent(i:PreviewInput<'markPreviewEffectSent'>){return transaction(db,()=>{
   const r=backend(i);if(r.state!=='PREPARED')return {dispatch:false,effect:effectView(r)};
   if(r.revision!==i.expectedRevision)fail('PREVIEW_EFFECT_REVISION_CHANGED');
    dispatchAllowed(r);
   // This is the only dispatch grant. Recovery of SENT/UNKNOWN can inspect the
   // original remoteKey but cannot obtain a second grant.
   exec("UPDATE preview_effects SET state='SENT',revision=revision+1 WHERE operation_id=?",i.operationId);return {dispatch:true,effect:effectView(effect(i.operationId))};
  });},
  recordPreviewEffectObservation(i:PreviewInput<'recordPreviewEffectObservation'>){return transaction(db,()=>{
   const r=backend(i),o=i.observation,body=canonical(o),last=get('SELECT observation_json FROM preview_effect_observations WHERE operation_id=? ORDER BY sequence DESC LIMIT 1',i.operationId);
   if(last?.observation_json===body)return effectView(r);
   if(r.state==='SUCCEEDED'||r.state==='FAILED')fail('PREVIEW_EFFECT_IMMUTABLE');
   // A backend may close an intent that never received a dispatch grant. This
   // releases stale PREPARED intents without inventing an external execution.
   if(r.state==='PREPARED'&&!(o.state==='FAILED'&&r.kind!=='PREVIEW_STOP')||r.revision!==i.expectedRevision)fail('PREVIEW_EFFECT_REVISION_CHANGED');
   if(o.state==='FAILED'&&r.kind==='PREVIEW_STOP')fail('PREVIEW_STOP_REQUIRES_EXIT_EVIDENCE');
   const d=dataset(String(r.dataset_id)),p=r.preview_id?preview(String(r.preview_id)):null;
   if(o.state==='SUCCEEDED'){
    const receipt=o.receipt;
    if(r.kind==='DATASET_PREPARE'){
     if(receipt.kind!=='DATASET_READY'||receipt.datasetId!==r.dataset_id||receipt.storageKey!==d.storage_key||receipt.originDatasetId!==d.source_dataset_id||receipt.schemaRevision!==d.schema_revision||receipt.snapshotAt<String(r.created_at)||receipt.snapshotAt>now())fail('PREVIEW_RECEIPT_CHANGED');
     exec("UPDATE datasets SET state='READY',revision=revision+1,snapshot_at=? WHERE dataset_id=?",receipt.snapshotAt,r.dataset_id!);
    }else if(r.kind==='PREVIEW_START'){
     if(receipt.kind!=='PREVIEW_READY'||receipt.previewId!==r.preview_id||receipt.datasetId!==r.dataset_id||receipt.imageDigest!==p!.image_digest||p!.instance_id!==null&&p!.instance_id!==receipt.instanceId||receipt.checkedAt<String(r.created_at)||receipt.checkedAt>now())fail('PREVIEW_RECEIPT_CHANGED');
      const runtime=latestRuntime(String(r.preview_id));if(runtime?.fact.state!=='HEALTHY'||runtime.fact.instanceId!==receipt.instanceId||runtime.fact.checkedAt!==receipt.checkedAt||Date.now()-Date.parse(receipt.checkedAt)>30000||get("SELECT 1 FROM preview_effects WHERE preview_id=? AND kind='PREVIEW_STOP'",r.preview_id!))fail('PREVIEW_HEALTH_NOT_VERIFIED');
     exec("UPDATE previews SET state='READY',revision=revision+1,instance_id=? WHERE preview_id=?",receipt.instanceId,r.preview_id!);
    }else{
     if((receipt.kind!=='PREVIEW_STOPPED'&&receipt.kind!=='PREVIEW_REMOVED')||receipt.previewId!==r.preview_id||receipt.instanceId!==p!.instance_id||receipt.checkedAt<String(r.created_at)||receipt.checkedAt>now())fail('PREVIEW_RECEIPT_CHANGED');
      const runtime=latestRuntime(String(r.preview_id));if(runtime?.fact.state!==(receipt.kind==='PREVIEW_REMOVED'?'REMOVED':'EXITED')||runtime.fact.instanceId!==receipt.instanceId||runtime.fact.checkedAt!==receipt.checkedAt)fail('PREVIEW_EXIT_NOT_VERIFIED');
     const request=json<{reason:string}>(r.request_json);exec('UPDATE previews SET state=?,revision=revision+1 WHERE preview_id=?',request.reason==='EXPIRED'?'EXPIRED':'STOPPED',r.preview_id!);
    }
   }else if(r.kind==='DATASET_PREPARE'){
    if(o.state==='FAILED')exec("UPDATE datasets SET state='MISSING',revision=revision+1 WHERE dataset_id=?",r.dataset_id!);
   }else exec('UPDATE previews SET state=?,revision=revision+1 WHERE preview_id=?',o.state==='FAILED'?'STOPPED':'UNKNOWN',r.preview_id!);
   const sequence=Number(r.revision)+1;exec('INSERT INTO preview_effect_observations VALUES(?,?,?,?)',i.operationId,sequence,body,now());
   exec('UPDATE preview_effects SET state=?,revision=?,receipt_json=?,error_code=? WHERE operation_id=?',o.state,sequence,o.state==='SUCCEEDED'?canonical(o.receipt):null,o.state==='SUCCEEDED'?null:o.errorCode,i.operationId);
   if(p)hooks.changed(String(r.run_id),i.operationId,{previewId:String(r.preview_id),state:preview(String(r.preview_id)).state as PreviewView['state']});else hooks.changed(String(r.run_id),i.operationId,{datasetId:String(r.dataset_id),state:dataset(String(r.dataset_id)).state as DatasetView['state']});
   return effectView(effect(i.operationId));
  });},
  listPreviewEffectHistory(i:PreviewInput<'listPreviewEffectHistory'>){backend(i);const rows=all('SELECT * FROM preview_effect_observations WHERE operation_id=? AND sequence>? ORDER BY sequence LIMIT ?',i.operationId,i.afterSequence,i.limit+1),more=rows.length>i.limit;if(more)rows.pop();return {items:rows.map(r=>({sequence:Number(r.sequence),observation:json<PreviewInput<'recordPreviewEffectObservation'>['observation']>(r.observation_json),observedAt:String(r.observed_at)})),nextSequence:more?Number(rows.at(-1)!.sequence):null};},
 };
 return {execute(method:PreviewMethod,input:unknown):unknown{const parsed=parseContract(previewRequests[method],input);return (handlers[method] as (i:unknown)=>unknown)(parsed);}};
}
