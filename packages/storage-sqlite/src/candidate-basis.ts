import {planAdmissionTable} from './plan-admissions.js';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {ids,inputManifest,parseContract,planDraft,productOutput} from '@devmesh/contracts';
import type {Draft} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest} from './migrations.js';
import type {createPlanDomain} from './plan-domain.js';
import {sourceManifest} from './workspace-protocol.js';
import type {GitDirectoryIdentity} from './workspace-protocol.js';
import type {SourceArchive} from './source-archive-protocol.js';
import {createPlanResults} from './plan-results.js';

type Row=Record<string,string|number|null>;
type Work=Draft['works'][number];
type Manifest=ReturnType<typeof inputManifest.parse>;
export interface CandidateSubject {principalId:string;runId:string;purpose:'run-candidate'|'work-input';workId?:string|undefined}
export interface CandidateProof {projectId:string;runId:string;commit:string;sourceArchiveOperationIds:string[];state:'ACKNOWLEDGED'}
export interface CandidateWorkFact {
 workId:string;workRevision:number;workEpoch:number;attemptId:string;role:string;outcome:string;admittedRunEpoch:number;
 codeCommit:string|null;inputManifestSha256:string;evidence:{artifactId:string;sha256:string};
 outputs:{slot:string;ref:{artifactId:string;sha256:string}}[];
}
export interface CandidateSource {
 workId:string;attemptId:string;archiveOperationId:string;allocationOperationId:string;commitOperationId:string;
 workspaceRef:string;baseCommit:string;commit:string;tree:string;manifestSha256:string;archiveRef:string;sourceRef:string;
}
export interface CandidateBasis {
 schemaVersion:'devmesh.candidate-basis.v1';projectId:string;runId:string;runEpoch:number;requirementRevision:number;planRevision:number;
 planHash:string;planDecisionId:string;purpose:'run-candidate'|'work-input';target:{workId:string;workRevision:number;workEpoch:number}|null;
 baseCommit:string;repository:{resourceId:string;identity:GitDirectoryIdentity};works:CandidateWorkFact[];sources:CandidateSource[];sha256:string;
}
function fail(code:string):never{throw new StorageError(code,409,'Current candidate source basis is unavailable');}
const ordered=<T>(items:readonly T[])=>[...items].sort((a,b)=>{const x=canonical(a),y=canonical(b);return x<y?-1:x>y?1:0;});
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);

/** Worker-only qualification; no filesystem I/O and no authority from a caller SHA. */
export function createCandidateBasis(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>,resolveCandidate:(commit:string)=>CandidateProof|null){
 const planResults=createPlanResults(db);
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
 function freeze(input:CandidateSubject):CandidateBasis {
  const carriedDecisions=new Map<string,string>();
  const run=plans.authorized(input.principalId,input.runId,true);
  if(run.control_gate!=='OPEN'||run.terminal_outcome!==null||run.current_plan_revision===null||run.current_requirement_revision===null)fail('CANDIDATE_ADMISSION_CLOSED');
  const planRow=get('SELECT * FROM plan_revisions WHERE run_id=? AND revision=?',input.runId,run.current_plan_revision!),confirmation=get(`SELECT 1 FROM ${planAdmissionTable(db)} WHERE run_id=? AND plan_revision=? AND requirement_revision=?`,input.runId,run.current_plan_revision!,run.current_requirement_revision!);
  if(!planRow||!confirmation||planRow.requirement_revision!==run.current_requirement_revision)fail('CANDIDATE_PLAN_CHANGED');
  const draft=parseContract(planDraft,JSON.parse(String(planRow.content_json))),graph=plans.inspect(run,draft);
  if(graph.issues.length||plans.pendingQuestions(input.runId)||plans.pendingInterpretation(input.runId,draft.requirementRevision)||plans.pendingSource(input.runId,draft.requirementRevision))fail('CANDIDATE_PLAN_UNRESOLVED');
  const decision=get("SELECT decision_id FROM decisions WHERE run_id=? AND subject_kind='PLAN' AND subject_id=?",input.runId,String(run.current_plan_revision));
  if(!decision)fail('CANDIDATE_PLAN_CHANGED');
  const repository=get("SELECT * FROM managed_repositories WHERE project_id=? AND state='READY'",run.project_id!);
  if(!repository?.identity_json)fail('CANDIDATE_REPOSITORY_UNAVAILABLE');
  const current=new Map<string,Work>(draft.works.map(work=>[work.workId,work])),epochs=new Map<string,number>(),blocked=new Set<string>(),facts=new Map<string,CandidateWorkFact>(),manifests=new Map<string,Manifest>();
  for(const work of draft.works){const state=get('SELECT work_epoch,blocked_reason FROM works WHERE run_id=? AND work_id=?',input.runId,work.workId);if(!state)fail('CANDIDATE_WORK_CHANGED');epochs.set(work.workId,Number(state.work_epoch));if(state.blocked_reason!==null)blocked.add(work.workId);}
  const target=input.workId?current.get(input.workId):undefined;
  if(input.purpose==='work-input'?!target:input.workId!==undefined)fail('CANDIDATE_TARGET_INVALID');
  if(target&&blocked.has(target.workId))fail('CANDIDATE_ADMISSION_CLOSED');
  const ready=(artifactId:string,expectedHash?:string)=>{
   const artifact=get("SELECT a.content_hash FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.project_id=? AND a.run_id=? AND a.state='READY' AND c.state='READY'",artifactId,run.project_id!,input.runId);
   if(!artifact||expectedHash!==undefined&&artifact.content_hash!==expectedHash)fail('CANDIDATE_EVIDENCE_UNAVAILABLE');return String(artifact.content_hash);
  };
  function fact(work:Work){
   const old=facts.get(work.workId);if(old)return old;
   const qualified=planResults.resolve(input.runId,Number(run.current_plan_revision),work.workId),row=qualified?.row;
   if(!row||row.work_revision!==work.workRevision||row.role!==work.role||row.ended_at===null||row.blocked_reason!==null||row.admitted_work_epoch!==row.current_work_epoch||!(row.state==='SUCCEEDED'&&row.outcome==='success'||row.state==='FAILED'&&row.outcome==='completed-with-findings'&&work.role==='tester'))fail('CANDIDATE_DEPENDENCY_UNSATISFIED');
   if(qualified?.carry)carriedDecisions.set(work.workId,qualified.carry.sourcePlanDecisionId);
   const outputs=JSON.parse(String(row.outputs_json)) as CandidateWorkFact['outputs'];for(const output of outputs)ready(output.ref.artifactId,output.ref.sha256);
   const manifest=parseContract(inputManifest,JSON.parse(String(row.input_manifest_json))),value:CandidateWorkFact={workId:work.workId,workRevision:work.workRevision,workEpoch:Number(row.current_work_epoch),attemptId:String(row.attempt_id),role:work.role,outcome:String(row.outcome),admittedRunEpoch:Number(row.admitted_run_epoch),codeCommit:row.code_commit as string|null,inputManifestSha256:digest(canonical(manifest)),evidence:{artifactId:String(row.evidence_artifact_id),sha256:ready(String(row.evidence_artifact_id))},outputs:ordered(outputs)};
   facts.set(work.workId,value);manifests.set(work.workId,manifest);return value;
  }
  const included=new Set<string>(),visiting=new Set<string>();
  function visit(work:Work,includeSelf:boolean){
   if(visiting.has(work.workId))fail('CANDIDATE_PLAN_CHANGED');visiting.add(work.workId);
   for(const edge of work.dependencies){const predecessor=current.get(edge.workId);if(!predecessor)fail('CANDIDATE_PLAN_CHANGED');const result=fact(predecessor!);if(result.outcome!=='success'&&!(result.outcome==='completed-with-findings'&&edge.requiredOutcome==='completed-with-findings'))fail('CANDIDATE_DEPENDENCY_UNSATISFIED');if(!included.has(edge.workId))visit(predecessor!,true);}
   visiting.delete(work.workId);if(includeSelf){fact(work);included.add(work.workId);}
  }
  if(target)visit(target,false);else for(const work of draft.works.filter(work=>work.role==='developer'))visit(work,true);
  const workOrder=graph.topology.map(node=>node.workId).filter(id=>included.has(id)),sources:CandidateSource[]=[],repositoryIdentity=JSON.parse(String(repository.identity_json)) as GitDirectoryIdentity;
  for(const workId of workOrder){
   const value=facts.get(workId)!;if(value.role!=='developer')continue;if(value.outcome!=='success'||!value.codeCommit)fail('CANDIDATE_SOURCE_UNVERIFIED');
   const row=get("SELECT * FROM source_archives WHERE project_id=? AND run_id=? AND attempt_id=? AND state='ACKNOWLEDGED' AND json_extract(manifest_json,'$.commit')=? ORDER BY rowid LIMIT 1",run.project_id!,input.runId,value.attemptId,value.codeCommit);
   if(!row?.manifest_json||!row.acknowledgement_json)fail('CANDIDATE_SOURCE_UNARCHIVED');
   const manifest=parseContract(sourceManifest,JSON.parse(String(row.manifest_json))),ack=JSON.parse(String(row.acknowledgement_json)) as NonNullable<SourceArchive['acknowledgement']>,original=JSON.parse(String(row.basis_json)) as SourceArchive['basis'],{sha256,...body}=manifest;
   if(sha256!==digest(canonical(body))||ack.commit!==value.codeCommit||ack.tree!==manifest.tree||ack.manifestSha256!==sha256||!same(ack.repositoryIdentity,repositoryIdentity)||!same(original.repository.identity,repositoryIdentity)||original.allocation.attemptId!==value.attemptId||original.commitOperation.prepared?.commit!==value.codeCommit||ack.archiveRef!=='refs/devmesh/source-archives/'+row.operation_id||ack.sourceRef!=='refs/devmesh/sources/'+value.codeCommit)fail('CANDIDATE_SOURCE_UNPROVEN');
   sources.push({workId,attemptId:value.attemptId,archiveOperationId:String(row.operation_id),allocationOperationId:String(row.allocation_operation_id),commitOperationId:String(row.commit_operation_id),workspaceRef:String(row.workspace_ref),baseCommit:original.allocation.baseCommit,commit:value.codeCommit,tree:manifest.tree,manifestSha256:sha256,archiveRef:ack.archiveRef,sourceRef:ack.sourceRef});
  }
  const byCommit=new Map(sources.map(source=>[source.commit,source])),byWork=new Map(sources.map(source=>[source.workId,source])),byArchive=new Map(sources.map(source=>[source.archiveOperationId,source]));
  function ancestors(work:Work){const result=new Set<string>();function collect(node:Work){for(const edge of node.dependencies){const parent=current.get(edge.workId)!;if(result.has(parent.workId))continue;result.add(parent.workId);collect(parent);}}collect(work);return [...result].map(id=>byWork.get(id)?.archiveOperationId).filter((id):id is string=>id!==undefined).sort();}
  function provenance(commit:string,stack=new Set<string>()):string[]{
   if(commit===run.base_commit)return [];if(stack.has(commit))fail('CANDIDATE_SOURCE_CYCLE');const next=new Set(stack).add(commit),source=byCommit.get(commit);
   if(source)return [...new Set([...provenance(source.baseCommit,next),source.archiveOperationId])].sort();
   const proof=resolveCandidate(commit);if(!proof||proof.state!=='ACKNOWLEDGED'||proof.projectId!==run.project_id||proof.runId!==input.runId||proof.commit!==commit||proof.sourceArchiveOperationIds.some(id=>!byArchive.has(id))||new Set(proof.sourceArchiveOperationIds).size!==proof.sourceArchiveOperationIds.length)fail('CANDIDATE_CODE_BASIS_UNPROVEN');return [...proof.sourceArchiveOperationIds].sort();
  }
  const req=get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',input.runId,run.current_requirement_revision!),requirements=parseContract(productOutput,JSON.parse(String(req?.content_json))).requirements;
  for(const workId of workOrder){
   const work=current.get(workId)!,value=facts.get(workId)!,manifest=manifests.get(workId)!,expected=ancestors(work);
   if(manifest.interfaces.length)fail('CANDIDATE_INTERFACE_BASIS_UNAVAILABLE');
   if(!manifest.codeCommit)fail('CANDIDATE_CODE_BASIS_UNPROVEN');
   if(!same(provenance(manifest.codeCommit),expected)||value.role==='developer'&&byWork.get(workId)?.baseCommit!==manifest.codeCommit||value.role!=='developer'&&value.codeCommit!==null&&!same(provenance(value.codeCommit),expected))fail('CANDIDATE_CODE_BASIS_CHANGED');
   const assigned=requirements.filter(item=>work.requirementIds.includes(item.id)).map(item=>({requirementId:item.id,sha256:digest(canonical(item))}));if(!same(ordered(assigned),ordered(manifest.requirements))||!manifest.decisionIds.includes(parseContract(ids.decision,carriedDecisions.get(workId)??decision.decision_id)))fail('CANDIDATE_INPUT_BASIS_CHANGED');
   const artifacts=new Map<string,{artifactId:string;sha256:string}>();
   for(const ref of work.inputRefs){const actual=ref.kind==='artifact'?ref:facts.get(ref.workId)?.outputs.find(output=>output.slot===ref.outputSlot)?.ref;if(!actual)fail('CANDIDATE_INPUT_BASIS_CHANGED');ready(actual!.artifactId,actual!.sha256);artifacts.set(actual!.artifactId,{artifactId:actual!.artifactId,sha256:actual!.sha256});}
   if(!same(ordered([...artifacts.values()]),ordered(manifest.artifacts)))fail('CANDIDATE_INPUT_BASIS_CHANGED');
  }
  if(!sources.length&&!target)fail('CANDIDATE_SOURCE_UNAVAILABLE');
  const basis:Omit<CandidateBasis,'sha256'>={schemaVersion:'devmesh.candidate-basis.v1',projectId:String(run.project_id),runId:input.runId,runEpoch:Number(run.run_epoch),requirementRevision:Number(run.current_requirement_revision),planRevision:Number(run.current_plan_revision),planHash:String(planRow.content_hash),planDecisionId:String(decision.decision_id),purpose:input.purpose,target:target?{workId:target.workId,workRevision:target.workRevision,workEpoch:epochs.get(target.workId)!}:null,baseCommit:String(run.base_commit),repository:{resourceId:String(repository.resource_id),identity:repositoryIdentity},works:workOrder.map(workId=>facts.get(workId)!),sources};
  return {...basis,sha256:digest(canonical(basis))};
 }
 return {freeze,assertCurrent(original:CandidateBasis,principalId:string){const current=freeze({principalId,runId:original.runId,purpose:original.purpose,...(original.target?{workId:original.target.workId}:{})});if(!same(current,original))fail('CANDIDATE_BASIS_CHANGED');return current;}};
}
