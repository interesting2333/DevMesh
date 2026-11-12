import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import type {createAcceptanceDomain} from './acceptance-domain.js';
import type {AcceptancePreparation} from './acceptance-protocol.js';
import {acceptanceReadinessRequests,acceptancePreparedProof,acceptancePreparationObservation} from './acceptance-readiness-protocol.js';
import type {AcceptanceReadiness,AcceptancePreparedProof,AcceptancePreparationObservation,AcceptanceReadinessInput,AcceptanceReadinessMethod} from './acceptance-readiness-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
type Row=Record<string,string|number|null>;
type Bound=AcceptanceReadinessInput<'getAcceptanceReadiness'>;
const json=<T>(v:unknown):T=>JSON.parse(String(v)) as T,hash=(v:unknown)=>digest(canonical(v));
const fail=(code:string,status=409):never=>{throw new StorageError(code,status,'Acceptance readiness requires the original trusted preparation, current fences and exact held service');};
export function createAcceptanceReadinessDomain(db:DatabaseSync,acceptances:Pick<ReturnType<typeof createAcceptanceDomain>,'getPreparation'>,changed:(runId:string,operationId:string,sequence:number,state:AcceptancePreparationObservation['state'])=>void){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
  const original=(i:Bound)=>{const p=acceptances.getPreparation(i);if(p.requestHash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');return p;};
  const service=(i:Bound)=>{const p=original(i);if(i.principalId!==p.request.backendPrincipalId)fail('FORBIDDEN',403);return p;};
  const latest=(id:string)=>get('SELECT * FROM acceptance_preparation_observations WHERE operation_id=? ORDER BY sequence DESC LIMIT 1',id);
  const pending=(projectId:string)=>!!get("SELECT 1 FROM preview_access_requests WHERE project_id=? AND is_write=1 AND state IN ('DISPATCHED','UNKNOWN')",projectId)||!!get("SELECT 1 FROM preview_effects WHERE project_id=? AND state IN ('PREPARED','SENT','UNKNOWN')",projectId);
  function validate(p:AcceptancePreparation,proof:AcceptancePreparedProof,o:Extract<AcceptancePreparationObservation,{state:'READY'}>){
    const r=p.request,d=proof.data,s=proof.sourceFence,c=proof.service.claim,h=o.health;
    if(p.qualification!=='CURRENT')fail('ACCEPTANCE_BASIS_CHANGED');
    for(const k of ['operationId','releaseId','projectId','runId','candidateId','manifestHash','reviewHash','dataPlanHash','runnerId','backendRef'] as const)if(proof[k]!==r[k])fail('ACCEPTANCE_PROOF_CHANGED');
    if(proof.requestHash!==p.requestHash||d.datasetId!==r.target.datasetId||d.storageKey!==r.target.storageKey||d.schemaRevision!==r.target.schemaRevision||d.originDatasetId!==(r.dataPlan.strategy==='PRESERVE_MIGRATE'?r.source!.datasetId:null)||d.sourceReleaseId!==r.expectedAcceptedReleaseId||canonical(d.migrationRef)!==canonical(r.dataPlan.migrationRef))fail('ACCEPTANCE_DATA_PROOF_CHANGED');
    if((r.source===null)!==(s===null))fail('ACCEPTANCE_SOURCE_FENCE_REQUIRED');
    if(s){
      if(s.datasetId!==r.source!.datasetId||s.datasetOperationId!==r.source!.datasetOperationId||s.closeOperationId!==p.operationId)fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
      const g=get('SELECT * FROM preview_write_gates WHERE dataset_id=?',s.datasetId),closure=get('SELECT * FROM preview_write_closures WHERE operation_id=?',s.closeOperationId);
      if(!g||g.project_id!==p.projectId||g.dataset_operation_id!==s.datasetOperationId||g.state!=='CLOSED'||g.close_operation_id!==s.closeOperationId||g.close_request_hash!==s.closeRequestHash||g.fence!==s.gateFence||!closure||closure.dataset_id!==s.datasetId||closure.request_hash!==s.closeRequestHash||hash(json(closure.request_json))!==s.closeRequestHash)fail('ACCEPTANCE_SOURCE_FENCE_CHANGED');
      if(String(g.updated_at)>s.physical.heldAt||s.physical.heldAt>d.snapshotAt)fail('ACCEPTANCE_SNAPSHOT_PRECEDES_FENCE');
    }
    if(proof.targetFence.datasetId!==r.target.datasetId||proof.targetFence.physical.heldAt>proof.preparedAt||s&&s.physical.fenceId===proof.targetFence.physical.fenceId)fail('ACCEPTANCE_TARGET_FENCE_CHANGED');
    if(c.operationId!==p.operationId||c.acceptanceRequestHash!==p.requestHash||c.releaseId!==r.releaseId||c.candidateId!==r.candidateId||c.manifestHash!==r.manifestHash||c.datasetId!==r.target.datasetId||c.imageDigest!==r.image.imageDigest||hash(c)!==proof.service.claimHash)fail('ACCEPTANCE_SERVICE_PROOF_CHANGED');
    if(h.instanceId!==c.instanceId||h.datasetId!==c.datasetId||h.imageDigest!==c.imageDigest||canonical(h.endpoint)!==canonical(proof.service.endpoint)||h.claimHash!==proof.service.claimHash||h.custodyRevision<proof.service.custodyRevision)fail('ACCEPTANCE_HEALTH_PROOF_CHANGED');
    if(o.fences.sourceProofHash!==(s?.physical.proofHash??null)||o.fences.targetProofHash!==proof.targetFence.physical.proofHash)fail('ACCEPTANCE_CURRENT_FENCE_CHANGED');
    if(d.snapshotAt<p.createdAt||d.snapshotAt>proof.preparedAt||proof.preparedAt<p.createdAt||proof.preparedAt>o.checkedAt)fail('ACCEPTANCE_PROOF_TIME_INVALID');
    const age=Date.now()-Date.parse(o.checkedAt);if(age<0||age>30000)fail('ACCEPTANCE_HEALTH_EXPIRED');
    if(pending(p.projectId))fail('ACCEPTANCE_EFFECT_UNRESOLVED');
  }
  function view(p:AcceptancePreparation):AcceptanceReadiness{
    const row=latest(p.operationId),stored=get('SELECT * FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId),proof=stored?acceptancePreparedProof.parse(json(stored.proof_json)):null,o=row?acceptancePreparationObservation.parse(json(row.observation_json)):null;
    const value:AcceptanceReadiness={operationId:p.operationId,requestHash:p.requestHash,sequence:Number(row?.sequence??0),state:'UNPREPARED',reasonCode:null,proofHash:stored?String(stored.proof_hash):null,proof,observation:o};
    if(p.qualification!=='CURRENT')return {...value,state:'STALE',reasonCode:'ACCEPTANCE_BASIS_CHANGED'};
    if(!o)return value;
    if(o.state==='UNKNOWN')return {...value,state:'UNAVAILABLE',reasonCode:o.errorCode};
    try{if(!proof||stored!.request_hash!==p.requestHash||hash(proof)!==stored!.proof_hash||canonical(proof)!==canonical(o.proof))fail('ACCEPTANCE_PROOF_CHANGED');validate(p,proof,o);if(p.state==='UNKNOWN'&&p.updatedAt>String(row!.observed_at))fail('ACCEPTANCE_BACKEND_UNCERTAIN');return {...value,state:'READY'};}
    catch(error){if(error instanceof StorageError)return {...value,state:'UNAVAILABLE',reasonCode:error.code};throw error;}
  }
  const handlers={
    verifyAcceptancePreparation(i:AcceptanceReadinessInput<'verifyAcceptancePreparation'>){const p=service(i);if(!['SENT','UNKNOWN'].includes(p.state)||get('SELECT 1 FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId))return {allowed:false,reasonCode:'ACCEPTANCE_DISPATCH_CLOSED'};if(p.qualification!=='CURRENT')return {allowed:false,reasonCode:'ACCEPTANCE_BASIS_CHANGED'};if(pending(p.projectId))return {allowed:false,reasonCode:'ACCEPTANCE_EFFECT_UNRESOLVED'};return {allowed:true,reasonCode:null};},
    getAcceptanceReadiness(i:AcceptanceReadinessInput<'getAcceptanceReadiness'>){return view(original(i));},
    recordAcceptancePreparationObservation(i:AcceptanceReadinessInput<'recordAcceptancePreparationObservation'>){
      const p=service(i),o=i.observation,body=canonical(o);if(!['SENT','UNKNOWN'].includes(p.state))fail('ACCEPTANCE_NOT_DISPATCHED');
      if(get('SELECT 1 FROM acceptance_preparation_observations WHERE operation_id=? AND observation_hash=?',p.operationId,digest(body)))return view(p);
      const last=latest(p.operationId),prior=last?acceptancePreparationObservation.parse(json(last.observation_json)):null;
      if(Number(last?.sequence??0)!==i.expectedSequence)fail('ACCEPTANCE_OBSERVATION_CHANGED');
      if(o.checkedAt<p.createdAt||o.checkedAt>new Date().toISOString()||prior&&o.checkedAt<prior.checkedAt)fail('ACCEPTANCE_OBSERVATION_STALE');
      if(o.state==='READY'){
        validate(p,o.proof,o);
        const highWater=get("SELECT max(json_extract(observation_json,'$.health.custodyRevision')) n FROM acceptance_preparation_observations WHERE operation_id=? AND json_extract(observation_json,'$.state')='READY'",p.operationId);
        if(highWater?.n!==null&&highWater?.n!==undefined&&o.health.custodyRevision<Number(highWater.n))fail('ACCEPTANCE_OBSERVATION_STALE');
        const proofBody=canonical(o.proof),old=get('SELECT * FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId);
        if(old&&(old.request_hash!==p.requestHash||old.proof_hash!==digest(proofBody)||old.proof_json!==proofBody))fail('ACCEPTANCE_PROOF_IMMUTABLE');
        if(!old)exec('INSERT INTO acceptance_prepared_proofs VALUES(?,?,?,?,?)',p.operationId,p.requestHash,digest(proofBody),proofBody,new Date().toISOString());
      }
      const sequence=i.expectedSequence+1;exec('INSERT INTO acceptance_preparation_observations VALUES(?,?,?,?,?)',p.operationId,sequence,digest(body),body,new Date().toISOString());changed(p.runId,p.operationId,sequence,o.state);return view(original(i));
    },
    listAcceptancePreparationObservations(i:AcceptanceReadinessInput<'listAcceptancePreparationObservations'>){original(i);const rows=all('SELECT * FROM acceptance_preparation_observations WHERE operation_id=? AND sequence>? ORDER BY sequence LIMIT ?',i.operationId,i.afterSequence,i.limit+1),page=rows.slice(0,i.limit);return {items:page.map(r=>({sequence:Number(r.sequence),observation:acceptancePreparationObservation.parse(json(r.observation_json)),observedAt:String(r.observed_at)})),nextSequence:rows.length>i.limit?Number(page.at(-1)!.sequence):null};},
  };
  return {execute(method:AcceptanceReadinessMethod,input:unknown):unknown{const parsed=parseContract(acceptanceReadinessRequests[method],input);return transaction(db,()=>(handlers[method] as (i:unknown)=>unknown)(parsed));}};
}
