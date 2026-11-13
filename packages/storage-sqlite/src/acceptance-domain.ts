import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertResourceVersion,parseContract,ids} from '@devmesh/contracts';
import type {Meta,OperationResult} from './protocol.js';
import type {createPlanDomain} from './plan-domain.js';
import type {createReleaseFreezeDomain} from './release-freeze-domain.js';
import type {createCandidateReviewDomain} from './candidate-review-domain.js';
import {acceptanceRequests,acceptanceBackendPolicy,acceptancePreparationRequest} from './acceptance-protocol.js';
import type {AcceptanceMethod,AcceptanceInput,AcceptancePreparation,AcceptancePreparationRequest} from './acceptance-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
import {previewWriteCloseRequest} from './preview-access-protocol.js';
import type {PreviewWriteGate} from './preview-access-protocol.js';
import type {AcceptanceResults} from './acceptance-protocol.js';
type Row=Record<string,string|number|null>;
interface Hooks {
  operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize:()=>void):OperationResult;
  changed(runId:string,operationId:string,preparationId:string,state:AcceptancePreparation['state']):void;
  decision(runId:string,operationId:string,decisionId:string):void;
  sourceClosed(runId:string,operationId:string,datasetId:string,fence:number):void;
}
function fail(code:string,status=409):never{throw new StorageError(code,status,'Acceptance preparation requires exact current review, original accepted data and configured authority');}
const json=<T>(value:unknown):T=>JSON.parse(String(value)) as T;
export function createAcceptanceDomain(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>,freezes:Pick<ReturnType<typeof createReleaseFreezeDomain>,'getCandidate'>,reviews:Pick<ReturnType<typeof createCandidateReviewDomain>,'getReview'>,hooks:Hooks){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p),now=()=>new Date().toISOString(),uid=(kind:string)=>kind+'_'+randomUUID().replaceAll('-','');
  function owner(principalId:string,runId:string){const r=plans.authorized(principalId,runId);if(r.membership!=='owner')fail('FORBIDDEN',403);return r;}
  const policy=(projectId:string,hash:string)=>acceptanceBackendPolicy.parse(json(get('SELECT policy_json FROM acceptance_backend_policies WHERE project_id=? AND policy_hash=?',projectId,hash)?.policy_json??fail('ACCEPTANCE_BACKEND_NOT_CONFIGURED',503)));
  const row=(id:string)=>get('SELECT * FROM acceptance_preparations WHERE operation_id=?',id)??fail('ACCEPTANCE_PREPARATION_NOT_FOUND',404);
  function backend(principalId:string,r:Row){if(policy(String(r.project_id),String(r.policy_hash)).backendPrincipalId!==principalId)fail('FORBIDDEN',403);}
  function scoped(principalId:string,r:Row){if(policy(String(r.project_id),String(r.policy_hash)).backendPrincipalId!==principalId)plans.authorized(principalId,String(r.run_id));return r;}
  function basis(principalId:string,i:Pick<AcceptanceInput<'beginAcceptancePreparation'>,'runId'|'candidateId'|'candidateRevision'|'manifestHash'|'reviewHash'|'expectedAcceptedReleaseId'|'dataPlanHash'>){
    const run=owner(principalId,i.runId),candidate=freezes.getCandidate({principalId,runId:i.runId,candidateId:i.candidateId});
    const review=reviews.getReview({principalId,runId:i.runId,candidateId:i.candidateId});
    if(!review.canPrepareAcceptance||candidate.qualification!=='CURRENT'||candidate.revision!==i.candidateRevision||candidate.manifestHash!==i.manifestHash||review.reviewHash!==i.reviewHash)fail('ACCEPTANCE_BASIS_CHANGED');
    const data=candidate.manifest.delivery.record.dataPlan!;
    if(digest(canonical(data))!==i.dataPlanHash||data.sourceReleaseId!==i.expectedAcceptedReleaseId||(get('SELECT accepted_release_id FROM projects WHERE project_id=?',candidate.projectId)!.accepted_release_id??null)!==i.expectedAcceptedReleaseId)fail('ACCEPTANCE_SOURCE_CHANGED');
    let source:AcceptancePreparationRequest['source']=null;
    if(i.expectedAcceptedReleaseId){
      const release=get('SELECT prepared_data_ref FROM releases WHERE project_id=? AND release_id=?',candidate.projectId,i.expectedAcceptedReleaseId)??fail('ACCEPTANCE_SOURCE_CHANGED'),d=get('SELECT * FROM datasets WHERE project_id=? AND dataset_id=?',candidate.projectId,release.prepared_data_ref!)??fail('ACCEPTANCE_SOURCE_UNAVAILABLE');
      if(!['READY','WRITE_FROZEN'].includes(String(d.state)))fail('ACCEPTANCE_SOURCE_UNAVAILABLE');
      source={releaseId:i.expectedAcceptedReleaseId,datasetId:ids.dataset.parse(d.dataset_id),datasetOperationId:ids.operation.parse(d.operation_id),storageKey:String(d.storage_key),schemaRevision:String(d.schema_revision)};
    }else if(data.strategy!=='INITIAL')fail('ACCEPTANCE_SOURCE_CHANGED');
    return {run,candidate,data,source};
  }
  function current(r:Row){try{const request=acceptancePreparationRequest.parse(json(r.request_json)),b=basis(String(r.principal_id),request);return canonical(b.source)===canonical(request.source)&&b.run.run_epoch===request.runEpoch;}catch(error){if(error instanceof StorageError)return false;throw error;}}
  const view=(r:Row):AcceptancePreparation=>{
    const commit=get('SELECT acceptance_operation_id FROM acceptance_commits WHERE preparation_operation_id=?',r.operation_id!),abort=get('SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=?',r.operation_id!),aborted=get('SELECT 1 FROM acceptance_abort_completions WHERE preparation_operation_id=?',r.operation_id!);
    return {operationId:String(r.operation_id),projectId:String(r.project_id),runId:String(r.run_id),candidateId:String(r.candidate_id),policyHash:String(r.policy_hash),releaseId:String(r.release_id),requestHash:String(r.request_hash),request:acceptancePreparationRequest.parse(json(r.request_json)),state:r.state as AcceptancePreparation['state'],revision:Number(r.revision),qualification:current(r)?'CURRENT':'STALE',errorCode:r.error_code as string|null,createdAt:String(r.created_at),updatedAt:String(r.updated_at),resolution:commit?'COMMITTED':aborted?'ABORTED':abort?'ABORTING':r.state==='FAILED'?'UNSENT_FAILED':'UNRESOLVED',acceptanceOperationId:commit?String(commit.acceptance_operation_id):null};
  };
  function writeGate(datasetId:string):PreviewWriteGate{
    const g=get('SELECT * FROM preview_write_gates WHERE dataset_id=?',datasetId)??fail('ACCEPTANCE_WRITE_GATE_MISSING');
    return {datasetId,projectId:String(g.project_id),datasetOperationId:String(g.dataset_operation_id),datasetRequestHash:String(g.dataset_request_hash),state:g.state as PreviewWriteGate['state'],fence:Number(g.fence),revision:Number(g.revision),closeOperationId:g.close_operation_id as string|null,closeRequestHash:g.close_request_hash as string|null,pendingWrites:Number(get("SELECT count(*) n FROM preview_access_requests WHERE dataset_id=? AND is_write=1 AND state IN ('DISPATCHED','UNKNOWN')",datasetId)!.n),createdAt:String(g.created_at),updatedAt:String(g.updated_at)};
  }
  function bound(i:{principalId:string;operationId:string;requestHash:string},trusted=false){const r=scoped(i.principalId,row(i.operationId));if(trusted)backend(i.principalId,r);if(r.request_hash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');return r;}
  function history(r:Row,operationId=String(r.operation_id)){
    const snapshot={state:r.state,revision:r.revision,errorCode:r.error_code,observedAt:r.updated_at};
    exec('INSERT INTO acceptance_preparation_history VALUES(?,?,?,?)',r.operation_id!,r.revision!,canonical(snapshot),r.updated_at!);
    hooks.changed(String(r.run_id),operationId,String(r.operation_id),r.state as AcceptancePreparation['state']);return view(r);
  }
  const handlers={
    registerAcceptanceBackendPolicy(i:AcceptanceInput<'registerAcceptanceBackendPolicy'>){return transaction(db,()=>{const member=get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',i.projectId,i.principalId)??fail('RESOURCE_NOT_FOUND',404);if(member.role!=='owner')fail('FORBIDDEN',403);const body=canonical(i.policy),policyHash=digest(body);exec('INSERT OR IGNORE INTO acceptance_backend_policies VALUES(?,?,?,?,?)',i.projectId,policyHash,body,i.principalId,now());return {policyHash,policy:i.policy};});},
    recordAcceptanceReplacementDecision(i:AcceptanceInput<'recordAcceptanceReplacementDecision'>){
      if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);const {meta,ifMatch:_match,...payload}=i;
      const op=hooks.operation(meta,'ConfirmAcceptanceReplacement',payload,operationId=>{const b=basis(meta.principalId,i);assertResourceVersion(i.ifMatch,Number(b.run.resource_revision));if(b.data.strategy!=='REPLACE'||b.data.replacementDecisionId!==i.decisionId||!i.expectedAcceptedReleaseId)fail('ACCEPTANCE_REPLACEMENT_NOT_APPLICABLE');
        exec('INSERT INTO acceptance_data_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?)',i.decisionId,operationId,b.candidate.projectId,i.runId,i.candidateId,i.manifestHash,i.reviewHash,i.expectedAcceptedReleaseId,i.dataPlanHash,meta.principalId,now());hooks.decision(i.runId,operationId,i.decisionId);return {decisionId:i.decisionId};},()=>{owner(meta.principalId,i.runId);});
      return {decisionId:String(op.result!.decisionId),operationId:op.operationId};
    },
    beginAcceptancePreparation(i:AcceptanceInput<'beginAcceptancePreparation'>){
      if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);const {meta,ifMatch:_match,...payload}=i;
      const op=hooks.operation(meta,'BeginAcceptancePreparation',payload,operationId=>{
        const b=basis(meta.principalId,i);assertResourceVersion(i.ifMatch,Number(b.run.resource_revision));const p=policy(b.candidate.projectId,i.policyHash);
        if(get("SELECT 1 FROM acceptance_preparations p WHERE project_id=? AND state<>'FAILED' AND NOT EXISTS(SELECT 1 FROM acceptance_commits c WHERE c.preparation_operation_id=p.operation_id) AND NOT EXISTS(SELECT 1 FROM acceptance_abort_completions a WHERE a.preparation_operation_id=p.operation_id)",b.candidate.projectId))fail('ACCEPTANCE_PREPARATION_UNRESOLVED');
        if(get("SELECT 1 FROM preview_effects WHERE project_id=? AND state IN ('PREPARED','SENT','UNKNOWN')",b.candidate.projectId))fail('ACCEPTANCE_EFFECT_UNRESOLVED');
        if(p.templateVersion!==b.data.templateVersion||b.data.strategy==='INITIAL'&&!p.initialModes.includes(b.data.initialData)||b.data.strategy==='PRESERVE_MIGRATE'&&!p.allowPreserveMigration||b.data.strategy==='REPLACE'&&(!p.allowReplacement||!p.initialModes.includes(b.data.initialData)))fail('ACCEPTANCE_BACKEND_NOT_CONFIGURED',503);
        if(b.data.strategy==='REPLACE'){
          const d=get('SELECT * FROM acceptance_data_decisions WHERE decision_id=?',b.data.replacementDecisionId);
          if(!d||d.project_id!==b.candidate.projectId||d.run_id!==i.runId||d.candidate_id!==i.candidateId||d.manifest_hash!==i.manifestHash||d.review_hash!==i.reviewHash||d.source_release_id!==i.expectedAcceptedReleaseId||d.data_plan_hash!==i.dataPlanHash||d.actor_id!==meta.principalId)fail('ACCEPTANCE_REPLACEMENT_UNCONFIRMED');
        }
        const releaseId=uid('release'),datasetId=uid('dataset'),request=acceptancePreparationRequest.parse({schemaVersion:'devmesh.acceptance-prepare.v1',operationId,releaseId,projectId:b.candidate.projectId,runId:i.runId,candidateId:i.candidateId,candidateRevision:i.candidateRevision,manifestHash:i.manifestHash,reviewHash:i.reviewHash,expectedAcceptedReleaseId:i.expectedAcceptedReleaseId,dataPlanHash:i.dataPlanHash,runEpoch:b.candidate.manifest.runEpoch,requirementRevision:b.candidate.manifest.requirementRevision,planRevision:b.candidate.manifest.planRevision,codeCommit:b.candidate.manifest.codeCommit,image:b.candidate.manifest.delivery.record.image!,dataPlan:b.data,policyHash:i.policyHash,backendPrincipalId:p.backendPrincipalId,backendRef:p.backendRef,runnerId:p.runnerId,source:b.source,target:{datasetId,storageKey:b.candidate.projectId+'/'+datasetId+'/app.sqlite',schemaRevision:p.schemaRevision}}),body=canonical(request),at=now();
        if(Buffer.byteLength(body)>256*1024)fail('ACCEPTANCE_REQUEST_TOO_LARGE');
        exec("INSERT INTO acceptance_preparations VALUES(?,?,?,?,?,?,?,?,?,?,'PREPARED',1,NULL,?,?)",operationId,meta.principalId,b.candidate.projectId,i.runId,i.candidateId,i.policyHash,releaseId,datasetId,digest(body),body,at,at);history(row(operationId));return {preparationId:operationId};
      },()=>{owner(meta.principalId,i.runId);});return view(row(String(op.result!.preparationId)));
    },
    getAcceptancePreparation(i:AcceptanceInput<'getAcceptancePreparation'>){return transaction(db,()=>view(scoped(i.principalId,row(i.operationId))));},
    getAcceptanceDataset(i:AcceptanceInput<'getAcceptanceDataset'>):AcceptanceResults['getAcceptanceDataset']{return transaction(db,()=>{
      const p=bound(i),d=get('SELECT d.*,p.request_hash,p.base_release_id FROM datasets d JOIN dataset_preparations p ON p.dataset_id=d.dataset_id WHERE p.operation_id=? AND p.purpose=\'ACCEPTANCE\'',i.operationId)??fail('ACCEPTANCE_DATASET_MISSING');
      return {dataset:{datasetId:String(d.dataset_id),projectId:String(d.project_id),runId:String(d.run_id),candidateId:String(d.candidate_id),operationId:String(d.operation_id),policyHash:String(d.policy_hash),sourceDatasetId:d.source_dataset_id as string|null,sourceReleaseId:d.source_release_id as string|null,storageKey:String(d.storage_key),schemaRevision:String(d.schema_revision),state:d.state as AcceptanceResults['getAcceptanceDataset']['dataset']['state'],revision:Number(d.revision),snapshotAt:d.snapshot_at as string|null,retentionUntil:String(d.retention_until),createdAt:String(d.created_at)},purpose:'ACCEPTANCE',baseReleaseId:d.base_release_id as string|null,requestHash:String(p.request_hash),gate:writeGate(String(d.dataset_id))};
    });},
    closeAcceptanceSourceWriteGate(i:AcceptanceInput<'closeAcceptanceSourceWriteGate'>):AcceptanceResults['closeAcceptanceSourceWriteGate']{return transaction(db,()=>{
      const p=bound(i,true),r=acceptancePreparationRequest.parse(json(p.request_json));if(['ABORTING','ABORTED'].includes(view(p).resolution))fail('ACCEPTANCE_ABORT_REQUESTED');if(!r.source)fail('ACCEPTANCE_SOURCE_NOT_APPLICABLE');
      const d=get('SELECT * FROM dataset_preparations WHERE dataset_id=? AND project_id=? AND operation_id=?',r.source.datasetId,r.projectId,r.source.datasetOperationId)??fail('ACCEPTANCE_SOURCE_CHANGED');
      const request=previewWriteCloseRequest.parse({schemaVersion:'devmesh.preview-write-close.v1',operationId:i.operationId,projectId:r.projectId,datasetId:r.source.datasetId,datasetOperationId:r.source.datasetOperationId,datasetRequestHash:d.request_hash,expectedFence:i.expectedFence}),body=canonical(request),requestHash=digest(body),old=get('SELECT * FROM preview_write_closures WHERE operation_id=?',i.operationId);
      if(old){if(old.request_json!==body||old.request_hash!==requestHash)fail('ACCEPTANCE_SOURCE_CLOSE_CHANGED');const gate=writeGate(r.source.datasetId);return {gate,closeRequest:request,current:gate.closeOperationId===i.operationId&&gate.closeRequestHash===requestHash};}
      if(p.revision!==i.expectedRevision||!['SENT','UNKNOWN'].includes(String(p.state)))fail('ACCEPTANCE_REVISION_CHANGED');if(!current(p))fail('ACCEPTANCE_BASIS_CHANGED');
      const g=writeGate(r.source.datasetId);if(g.datasetOperationId!==r.source.datasetOperationId||g.datasetRequestHash!==d.request_hash||g.state!=='OPEN'||g.fence!==i.expectedFence)fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
      const at=now();exec('INSERT INTO preview_write_closures VALUES(?,?,?,?,?)',i.operationId,g.datasetId,requestHash,body,at);exec("UPDATE preview_write_gates SET state='CLOSED',fence=fence+1,revision=revision+1,close_operation_id=?,close_request_hash=?,updated_at=? WHERE dataset_id=?",i.operationId,requestHash,at,g.datasetId);
      const gate=writeGate(g.datasetId);exec('INSERT INTO preview_write_gate_events VALUES(?,?,?,?)',gate.datasetId,gate.revision,canonical(gate),at);hooks.sourceClosed(r.runId,i.operationId,gate.datasetId,gate.fence);return {gate,closeRequest:request,current:true};
    });},
    listAcceptancePreparations(i:AcceptanceInput<'listAcceptancePreparations'>){return transaction(db,()=>{if(policy(i.projectId,i.policyHash).backendPrincipalId!==i.principalId)fail('FORBIDDEN',403);const rows=all('SELECT rowid sequence,* FROM acceptance_preparations WHERE project_id=? AND policy_hash=? AND rowid>? ORDER BY rowid LIMIT ?',i.projectId,i.policyHash,i.afterSequence,i.limit+1),page=rows.slice(0,i.limit);return {items:page.map(r=>({sequence:Number(r.sequence),preparation:view(r)})),nextSequence:rows.length>i.limit?Number(page.at(-1)!.sequence):null};});},
    markAcceptancePreparationSent(i:AcceptanceInput<'markAcceptancePreparationSent'>){return transaction(db,()=>{const r=row(i.operationId);backend(i.principalId,r);if(r.request_hash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');if(r.state!=='PREPARED')return {dispatch:false,preparation:view(r)};if(r.revision!==i.expectedRevision)fail('ACCEPTANCE_REVISION_CHANGED');if(!current(r))fail('ACCEPTANCE_BASIS_CHANGED');if(get("SELECT 1 FROM preview_effects WHERE project_id=? AND state IN ('PREPARED','SENT','UNKNOWN')",r.project_id!))fail('ACCEPTANCE_EFFECT_UNRESOLVED');exec("UPDATE acceptance_preparations SET state='SENT',revision=revision+1,updated_at=? WHERE operation_id=?",now(),i.operationId);return {dispatch:true,preparation:history(row(i.operationId))};});},
    markAcceptancePreparationUnknown(i:AcceptanceInput<'markAcceptancePreparationUnknown'>){return transaction(db,()=>{const r=row(i.operationId);backend(i.principalId,r);if(r.request_hash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');if(get('SELECT 1 FROM acceptance_abort_decisions WHERE preparation_operation_id=?',i.operationId))fail('ACCEPTANCE_ABORT_REQUESTED');if(get('SELECT 1 FROM acceptance_commits WHERE preparation_operation_id=?',i.operationId))fail('ACCEPTANCE_ALREADY_COMMITTED');if(r.state==='UNKNOWN'&&r.error_code===i.errorCode)return view(r);if(!['SENT','UNKNOWN'].includes(String(r.state))||r.revision!==i.expectedRevision)fail('ACCEPTANCE_REVISION_CHANGED');exec("UPDATE acceptance_preparations SET state='UNKNOWN',revision=revision+1,error_code=?,updated_at=? WHERE operation_id=?",i.errorCode,now(),i.operationId);return history(row(i.operationId));});},
    failUnsentAcceptancePreparation(i:AcceptanceInput<'failUnsentAcceptancePreparation'>){
      if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);const {meta,ifMatch:_match,...payload}=i;
      hooks.operation(meta,'FailUnsentAcceptancePreparation',payload,operationId=>{const run=owner(meta.principalId,i.runId),r=row(i.operationId);assertResourceVersion(i.ifMatch,Number(run.resource_revision));if(r.run_id!==i.runId||r.request_hash!==i.requestHash)fail('ACCEPTANCE_PREPARATION_NOT_FOUND',404);if(r.state!=='PREPARED')fail('ACCEPTANCE_EFFECT_UNRESOLVED');exec("UPDATE acceptance_preparations SET state='FAILED',revision=revision+1,error_code='ACCEPTANCE_NOT_SENT',updated_at=? WHERE operation_id=?",now(),i.operationId);history(row(i.operationId),operationId);return {preparationId:i.operationId};},()=>{owner(meta.principalId,i.runId);});return view(row(i.operationId));
    },
    listAcceptancePreparationHistory(i:AcceptanceInput<'listAcceptancePreparationHistory'>){return transaction(db,()=>{const r=scoped(i.principalId,row(i.operationId));if(r.request_hash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');const rows=all('SELECT * FROM acceptance_preparation_history WHERE operation_id=? AND sequence>? ORDER BY sequence LIMIT ?',i.operationId,i.afterSequence,i.limit+1),page=rows.slice(0,i.limit);return {items:page.map(r=>({sequence:Number(r.sequence),snapshot:json(r.snapshot_json)})),nextSequence:rows.length>i.limit?Number(page.at(-1)!.sequence):null};});},
  };
  return {getPreparation:(i:AcceptanceInput<'getAcceptancePreparation'>)=>view(scoped(i.principalId,row(i.operationId))),execute(method:AcceptanceMethod,input:unknown):unknown{const parsed=parseContract(acceptanceRequests[method],input);return (handlers[method] as (i:unknown)=>unknown)(parsed);}};
}
