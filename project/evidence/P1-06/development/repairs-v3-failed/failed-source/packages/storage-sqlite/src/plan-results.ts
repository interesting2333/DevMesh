import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {ids,inputManifest} from '@devmesh/contracts';
import {canonical} from './json.js';
import {digest} from './migrations.js';
type Row=Record<string,string|number|null>;
export interface CarriedResult {
 workId:string;workRevision:number;workEpoch:number;attemptId:string;sourcePlanRevision:number;
 requirementRevision:number;requirementSha256:string;definitionSha256:string;sourcePlanDecisionId:string;
 outcome:string;state:string;codeCommit:string|null;inputFingerprint:string;inputManifestSha256:string;
 checkConfigHash:string;templateVersion:string;admittedRunEpoch:number;roleSnapshotSha256:string;
 evidence:{artifactId:string;sha256:string};outputs:unknown;workVerification:{operationId:string;sha256:string}|null;
}
/** Both scheduling and Git source qualification use this exact original result. */
export function createPlanResults(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
 function latest(runId:string,workId:string){return get(`SELECT a.*,v.outcome,v.evidence_artifact_id,v.outputs_json,v.code_commit,s.plan_revision source_plan_revision,w.work_epoch current_work_epoch,w.blocked_reason
 FROM attempts a JOIN scheduled_work s ON s.attempt_id=a.attempt_id JOIN verified_work_results v ON v.attempt_id=a.attempt_id
 JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id WHERE a.run_id=? AND a.work_id=?
 AND a.attempt_no=(SELECT MAX(n.attempt_no) FROM attempts n WHERE n.run_id=a.run_id AND n.work_id=a.work_id)`,runId,workId);}
 function snapshot(row:Row):CarriedResult|null{
  if(row.ended_at===null||row.blocked_reason!==null||row.admitted_work_epoch!==row.current_work_epoch||!(row.state==='SUCCEEDED'&&row.outcome==='success'||row.state==='FAILED'&&row.outcome==='completed-with-findings'&&row.role==='tester'))return null;
  const plan=get('SELECT * FROM plan_revisions WHERE run_id=? AND revision=?',row.run_id!,row.source_plan_revision!),definition=get('SELECT definition_hash FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?',row.run_id!,row.work_id!,row.work_revision!),decision=get("SELECT decision_id FROM decisions WHERE run_id=? AND subject_kind='PLAN' AND subject_id=?",row.run_id!,String(row.source_plan_revision)),evidence=get("SELECT a.content_hash FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.run_id=? AND a.state='READY' AND c.state='READY'",row.evidence_artifact_id!,row.run_id!);
  if(!plan||!definition||!decision||!evidence||!get('SELECT 1 FROM plan_confirmations WHERE run_id=? AND plan_revision=? AND requirement_revision=?',row.run_id!,row.source_plan_revision!,plan.requirement_revision!))return null;
  const requirement=get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',row.run_id!,plan.requirement_revision!),manifest=inputManifest.parse(JSON.parse(String(row.input_manifest_json)));
  if(!requirement||!manifest.decisionIds.includes(ids.decision.parse(decision.decision_id))||manifest.interfaces.length)return null;
  const outputs=JSON.parse(String(row.outputs_json)) as {slot:string;ref:{artifactId:string;sha256:string}}[];
  for(const out of outputs)if(!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.run_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'",out.ref.artifactId,row.run_id!,out.ref.sha256))return null;
  const proof=get("SELECT operation_id,content_hash FROM work_verifications WHERE attempt_id=? AND state='APPLIED' AND artifact_id=?",row.attempt_id!,row.evidence_artifact_id!);
  return {workId:String(row.work_id),workRevision:Number(row.work_revision),workEpoch:Number(row.admitted_work_epoch),attemptId:String(row.attempt_id),sourcePlanRevision:Number(row.source_plan_revision),requirementRevision:Number(plan.requirement_revision),requirementSha256:digest(String(requirement.content_json)),definitionSha256:String(definition.definition_hash),sourcePlanDecisionId:String(decision.decision_id),outcome:String(row.outcome),state:String(row.state),codeCommit:row.code_commit as string|null,inputFingerprint:String(row.input_fingerprint),inputManifestSha256:digest(canonical(manifest)),checkConfigHash:manifest.checkConfigHash,templateVersion:manifest.templateVersion,admittedRunEpoch:Number(row.admitted_run_epoch),roleSnapshotSha256:digest(String(row.role_snapshot_json)),evidence:{artifactId:String(row.evidence_artifact_id),sha256:String(evidence.content_hash)},outputs,workVerification:proof?{operationId:String(proof.operation_id),sha256:String(proof.content_hash)}:null};
 }
 function resolve(runId:string,planRevision:number,workId:string,requireConfirmation=true){
  const row=latest(runId,workId),planned=get('SELECT work_revision FROM plan_works WHERE run_id=? AND plan_revision=? AND work_id=?',runId,planRevision,workId);
  if(!row||!planned||planned.work_revision!==row.work_revision)return null;
  if(row.ended_at===null||row.blocked_reason!==null||row.admitted_work_epoch!==row.current_work_epoch)return null;
  if(row.source_plan_revision===planRevision)return {row,carry:null};
  const carry=get('SELECT * FROM plan_carried_results WHERE run_id=? AND plan_revision=? AND work_id=?',runId,planRevision,workId),run=get('SELECT run_epoch,current_requirement_revision FROM runs WHERE run_id=?',runId),fact=snapshot(row);
  if(!carry||!run||!fact||carry.attempt_id!==row.attempt_id||carry.snapshot_json!==canonical(fact)||carry.snapshot_sha256!==digest(canonical(fact))||fact.requirementRevision!==run.current_requirement_revision||requireConfirmation&&!get('SELECT 1 FROM plan_confirmations WHERE run_id=? AND plan_revision=? AND requirement_revision=?',runId,planRevision,fact.requirementRevision))return null;
  return {row,carry:fact};
 }
 return {latest,snapshot,resolve};
}
