import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertResourceVersion,parseContract} from '@devmesh/contracts';
import type {Meta,OperationResult} from './protocol.js';
import type {createPlanDomain} from './plan-domain.js';
import type {createReleaseFreezeDomain} from './release-freeze-domain.js';
import type {createCandidateReviewDomain} from './candidate-review-domain.js';
import type {createAcceptanceDomain} from './acceptance-domain.js';
import type {createAcceptanceReadinessDomain} from './acceptance-readiness-domain.js';
import {acceptanceCommitRequests,releasePromotionRequest} from './acceptance-commit-protocol.js';
import type {AcceptedRelease,AcceptanceCommitInput,AcceptanceCommitMethod} from './acceptance-commit-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';

type Row=Record<string,string|number|null>;
interface Hooks {
  operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize:()=>void):OperationResult;
  completed(runId:string,operationId:string,candidateId:string,releaseId:string,attempts:{workId:string;attemptId:string}[]):void;
}
function fail(code:string,status=409):never{throw new StorageError(code,status,'Acceptance commit requires the exact current prepared and reviewed candidate');}
export function createAcceptanceCommitDomain(db:DatabaseSync,plans:Pick<ReturnType<typeof createPlanDomain>,'authorized'>,freezes:Pick<ReturnType<typeof createReleaseFreezeDomain>,'getCandidate'>,reviews:Pick<ReturnType<typeof createCandidateReviewDomain>,'getReview'>,acceptances:Pick<ReturnType<typeof createAcceptanceDomain>,'getPreparation'>,readiness:Pick<ReturnType<typeof createAcceptanceReadinessDomain>,'getReadiness'>,hooks:Hooks){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
  function owner(principalId:string,runId:string){const r=plans.authorized(principalId,runId);if(r.membership!=='owner')fail('FORBIDDEN',403);return r;}
  const handlers={
    commitReleaseAcceptance(i:AcceptanceCommitInput<'commitReleaseAcceptance'>){
      if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);
      const {meta,ifMatch:_match,...payload}=i;
      return hooks.operation(meta,'CommitReleaseAcceptance',payload,operationId=>{
        const principalId=meta.principalId,run=owner(principalId,i.runId);
        assertResourceVersion(i.ifMatch,Number(run.resource_revision));
        if(run.terminal_outcome!==null||run.phase!=='REVIEW'||run.control_gate!=='OPEN')fail('ACCEPTANCE_ADMISSION_CLOSED');
        const p=acceptances.getPreparation({principalId,operationId:i.preparationOperationId}),r=p.request;
        if(p.resolution==='ABORTING'||p.resolution==='ABORTED')fail('ACCEPTANCE_ABORT_REQUESTED');
        if(p.runId!==i.runId||p.requestHash!==i.requestHash)fail('ACCEPTANCE_REQUEST_CHANGED');
        if(get('SELECT 1 FROM acceptance_commits WHERE preparation_operation_id=?',p.operationId))fail('ACCEPTANCE_ALREADY_COMMITTED');
        if(p.revision!==i.expectedPreparationRevision||!['SENT','UNKNOWN'].includes(p.state))fail('ACCEPTANCE_REVISION_CHANGED');
        for(const key of ['candidateId','candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash'] as const)if(i[key]!==r[key])fail('ACCEPTANCE_BASIS_CHANGED');
        if(run.run_epoch!==r.runEpoch||run.current_plan_revision!==r.planRevision||run.current_requirement_revision!==r.requirementRevision)fail('ACCEPTANCE_BASIS_CHANGED');
        if((get('SELECT accepted_release_id FROM projects WHERE project_id=?',p.projectId)!.accepted_release_id??null)!==r.expectedAcceptedReleaseId)fail('ACCEPTANCE_SOURCE_CHANGED');
        const target={principalId,runId:i.runId,candidateId:i.candidateId},candidate=freezes.getCandidate(target),review=reviews.getReview(target);
        if(p.qualification!=='CURRENT'||candidate.qualification!=='CURRENT'||candidate.revision!==r.candidateRevision||candidate.manifestHash!==r.manifestHash||!review.canPrepareAcceptance||review.reviewHash!==r.reviewHash)fail('ACCEPTANCE_BASIS_CHANGED');
        if(candidate.manifest.codeCommit!==r.codeCommit||digest(canonical(candidate.manifest.delivery.record.dataPlan))!==r.dataPlanHash||canonical(candidate.manifest.delivery.record.image)!==canonical(r.image))fail('ACCEPTANCE_BASIS_CHANGED');
        const ready=readiness.getReadiness({principalId,operationId:i.preparationOperationId,requestHash:p.requestHash});
        if(ready.sequence!==i.expectedObservationSequence||ready.proofHash!==i.proofHash)fail('ACCEPTANCE_OBSERVATION_CHANGED');
        if(ready.state!=='READY'||!ready.proof)fail(ready.reasonCode??'ACCEPTANCE_NOT_READY');
        if(ready.proof.service.claim.schemaVersion!=='devmesh.acceptance-service-claim.v1')fail('ACCEPTANCE_SERVICE_PURPOSE_REQUIRED');
        // Recheck all recorded preflight materials inside T5; external byte reads
        // belong to trusted preflight before this synchronous writer transaction.
        for(const hash of candidate.preflightHashes)if(!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY'",hash))fail('ACCEPTANCE_CONTENT_UNAVAILABLE');
        const acceptedAt=new Date().toISOString(),receipt:AcceptedRelease={releaseId:r.releaseId,projectId:p.projectId,runId:i.runId,candidateId:r.candidateId,candidateRevision:r.candidateRevision,manifestHash:r.manifestHash,reviewHash:r.reviewHash,preparationOperationId:p.operationId,acceptanceOperationId:operationId,requestHash:p.requestHash,proofHash:i.proofHash,datasetId:r.target.datasetId,previousReleaseId:r.expectedAcceptedReleaseId,acceptedBy:principalId,acceptedAt,acceptanceState:'ACCEPTED',publicationState:'PENDING'};
        exec('INSERT INTO releases VALUES(?,?,?,?,?,?,?,?,?,?)',r.releaseId,p.projectId,i.runId,r.candidateId,r.candidateRevision,operationId,r.manifestHash,r.target.datasetId,principalId,acceptedAt);
        const switched=exec('UPDATE projects SET accepted_release_id=?,revision=revision+1,updated_at=? WHERE project_id=? AND accepted_release_id IS ?',r.releaseId,acceptedAt,p.projectId,r.expectedAcceptedReleaseId);
        if(Number(switched.changes)!==1)fail('ACCEPTANCE_SOURCE_CHANGED');
        exec('INSERT INTO acceptance_commits VALUES(?,?,?,?,?,?,?,?,?)',r.releaseId,p.operationId,operationId,i.proofHash,ready.sequence,p.revision,r.reviewHash,canonical(receipt),acceptedAt);
        const completed:{workId:string;attemptId:string}[]=[];
        for(const w of candidate.manifest.works.filter(w=>w.relation==='MANUAL_PENDING')){
          const a=w.assessment,results=review.items.filter(item=>item.kind==='work-human'&&item.subjectId===w.operationId||item.kind==='quality-human'&&item.subjectId===a.qualityOperationId);
          if(!results.length||results.some(item=>item.status!=='PASS'||!item.result))fail('ACCEPTANCE_HUMAN_COMPLETION_MISSING');
          if(a.automaticStatus!=='PENDING'||a.outcome!==null||a.checks.some(c=>c.status!=='PASS'&&!(c.status==='PENDING'&&['human-decision','quality-review'].includes(c.kind)&&c.code==='HUMAN_DECISION_REQUIRED')))fail('ACCEPTANCE_HUMAN_COMPLETION_INVALID');
          exec('INSERT INTO work_acceptance_completions VALUES(?,?,?,?,?,?,?,?,?)',w.operationId,w.attemptId,r.releaseId,operationId,r.candidateId,w.evidence.artifactId,r.reviewHash,canonical(results.map(item=>item.result!.resultId).sort()),acceptedAt);
          exec("INSERT INTO verified_work_results VALUES(?,'success',?,?,?,?)",w.attemptId,w.evidence.artifactId,canonical(a.outputs),a.codeCommit,acceptedAt);
          if(Number(exec("UPDATE attempts SET state='SUCCEEDED',ended_at=? WHERE attempt_id=? AND state='VERIFYING' AND ended_at IS NULL",acceptedAt,w.attemptId).changes)!==1)fail('ACCEPTANCE_HUMAN_COMPLETION_INVALID');
          exec('DELETE FROM role_slots WHERE attempt_id=?',w.attemptId);
          exec("UPDATE execution_grants SET status='REVOKED' WHERE attempt_id=?",w.attemptId);
          if(Number(exec("UPDATE work_verifications SET state='APPLIED',applied_at=? WHERE operation_id=? AND state='READY'",acceptedAt,w.operationId).changes)!==1)fail('ACCEPTANCE_HUMAN_COMPLETION_INVALID');
          completed.push({workId:w.workId,attemptId:w.attemptId});
        }
        if(get('SELECT 1 FROM attempts WHERE run_id=? AND ended_at IS NULL',i.runId)||get('SELECT 1 FROM role_slots WHERE run_id=?',i.runId))fail('ACCEPTANCE_ATTEMPT_UNFINISHED');
        if(Number(exec("UPDATE runs SET terminal_outcome='COMPLETED',ended_at=? WHERE run_id=? AND terminal_outcome IS NULL AND control_gate='OPEN' AND run_epoch=?",acceptedAt,i.runId,r.runEpoch).changes)!==1)fail('ACCEPTANCE_ADMISSION_CLOSED');
        const promotion=releasePromotionRequest.parse({schemaVersion:'devmesh.release-promotion.v1',acceptanceOperationId:operationId,preparation:r,preparedProof:ready.proof,proofHash:ready.proofHash}),body=canonical(promotion);
        exec('INSERT INTO release_promotion_outbox VALUES(?,?,?,?,?)',r.releaseId,operationId,digest(body),body,acceptedAt);
        hooks.completed(i.runId,operationId,r.candidateId,r.releaseId,completed);
        return {...receipt};
      },()=>{owner(meta.principalId,i.runId);});
    },
    getAcceptedRelease(i:AcceptanceCommitInput<'getAcceptedRelease'>):AcceptedRelease{
      const row=get('SELECT c.receipt_json,r.run_id FROM acceptance_commits c JOIN releases r ON r.release_id=c.release_id WHERE r.release_id=?',i.releaseId)??fail('ACCEPTED_RELEASE_NOT_FOUND',404);
      plans.authorized(i.principalId,String(row.run_id));return JSON.parse(String(row.receipt_json)) as AcceptedRelease;
    },
  };
  return {execute(method:AcceptanceCommitMethod,input:unknown):unknown{const parsed=parseContract(acceptanceCommitRequests[method],input),call=()=>(handlers[method] as (i:unknown)=>unknown)(parsed);return method==='commitReleaseAcceptance'?call():transaction(db,call);}};
}
