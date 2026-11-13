import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertResourceVersion,parseContract} from '@devmesh/contracts';
import type {Meta,OperationResult} from './protocol.js';
import type {createPlanDomain} from './plan-domain.js';
import type {createAcceptanceDomain} from './acceptance-domain.js';
import {acceptanceAbortDecision,acceptanceAbortRequests} from './acceptance-abort-protocol.js';
import type {AcceptanceAbortInput,AcceptanceAbortMethod,AcceptanceAbortRecord} from './acceptance-abort-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
interface Hooks {
  operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize:()=>void):OperationResult;
  requested(runId:string,operationId:string,preparationId:string):void;
}
type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Abort requires the exact uncommitted preparation and a current owner decision');}
export function createAcceptanceAbortDomain(db:DatabaseSync,plans:Pick<ReturnType<typeof createPlanDomain>,'authorized'>,acceptances:Pick<ReturnType<typeof createAcceptanceDomain>,'getPreparation'>,hooks:Hooks){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
  function owner(principalId:string,runId:string){const r=plans.authorized(principalId,runId);if(r.membership!=='owner')fail('FORBIDDEN',403);return r;}
  function record(id:string):AcceptanceAbortRecord|null{
    const row=get('SELECT * FROM acceptance_abort_decisions WHERE preparation_operation_id=?',id);if(!row)return null;
    const decision=acceptanceAbortDecision.parse(JSON.parse(String(row.decision_json)));
    if(decision.preparation.operationId!==id||digest(canonical(decision))!==row.decision_hash)fail('ACCEPTANCE_ABORT_DECISION_CHANGED');
    return {decision,decisionHash:String(row.decision_hash)};
  }
  const handlers={
    requestAcceptanceAbort(i:AcceptanceAbortInput<'requestAcceptanceAbort'>):AcceptanceAbortRecord{
      if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);const {meta,ifMatch:_match,...payload}=i;
      const op=hooks.operation(meta,'RequestAcceptanceAbort',payload,operationId=>{
        const run=owner(meta.principalId,i.runId);assertResourceVersion(i.ifMatch,Number(run.resource_revision));
        const p=acceptances.getPreparation({principalId:meta.principalId,operationId:i.preparationOperationId});
        if(p.runId!==i.runId||p.requestHash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');
        if(p.resolution==='COMMITTED')fail('ACCEPTANCE_ALREADY_COMMITTED');
        if(p.resolution==='ABORTING')fail('ACCEPTANCE_ABORT_ALREADY_REQUESTED');
        if(!['SENT','UNKNOWN'].includes(p.state))fail('ACCEPTANCE_NOT_DISPATCHED');
        if(p.revision!==i.expectedPreparationRevision)fail('ACCEPTANCE_PREPARATION_CHANGED');
        if(get('SELECT accepted_release_id FROM projects WHERE project_id=?',p.projectId)!.accepted_release_id!==p.request.expectedAcceptedReleaseId)fail('ACCEPTANCE_SOURCE_CHANGED');
        if(get('SELECT 1 FROM releases WHERE release_id=? OR prepared_data_ref=?',p.releaseId,p.request.target.datasetId))fail('ACCEPTANCE_ALREADY_COMMITTED');
        const proof=get('SELECT proof_hash FROM acceptance_prepared_proofs WHERE operation_id=?',p.operationId);
        const decision=acceptanceAbortDecision.parse({schemaVersion:'devmesh.acceptance-abort-decision.v1',operationId,preparation:p.request,preparationRequestHash:p.requestHash,preparationRevision:p.revision,preparedProofHash:proof?.proof_hash??null,requestedBy:meta.principalId,reason:i.reason,decidedAt:new Date().toISOString()}),body=canonical(decision),decisionHash=digest(body);
        db.prepare('INSERT INTO acceptance_abort_decisions VALUES(?,?,?,?,?,?,?)').run(p.operationId,operationId,p.requestHash,decisionHash,body,decision.preparedProofHash,decision.decidedAt);
        hooks.requested(i.runId,operationId,p.operationId);return {decision,decisionHash};
      },()=>{owner(meta.principalId,i.runId);});
      return op.result as unknown as AcceptanceAbortRecord;
    },
    getAcceptanceAbortDecision(i:AcceptanceAbortInput<'getAcceptanceAbortDecision'>){
      const p=acceptances.getPreparation({principalId:i.principalId,operationId:i.preparationOperationId});if(p.requestHash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');return record(p.operationId);
    },
  };
  return {execute(method:AcceptanceAbortMethod,input:unknown):unknown{const parsed=parseContract(acceptanceAbortRequests[method],input),call=()=>(handlers[method] as (i:unknown)=>unknown)(parsed);return method==='requestAcceptanceAbort'?call():transaction(db,call);}};
}
