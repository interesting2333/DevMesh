import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { inspectPlan, parseContract, planDraft, planReviewView, productOutput } from '@devmesh/contracts';
import type { Draft } from '@devmesh/contracts';
import { StorageError } from './errors.js';
import type { Parsed } from './protocol.js';
import {createPlanResults} from './plan-results.js';
import {canonical} from './json.js';
import {digest} from './migrations.js';
import type {CarriedResult} from './plan-results.js';

type Row=Record<string,string|number|null>;
export function createPlanDomain(db:DatabaseSync){
  const get=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).get(...params) as Row|undefined;
  const missing=()=>new StorageError('RESOURCE_NOT_FOUND',404,'Plan is not visible');
  function authorized(principalId:string,runId:string,write=false){
    const row=get('SELECT r.*,m.role AS membership,t.base_commit FROM runs r JOIN project_members m ON m.project_id=r.project_id AND m.principal_id=? JOIN user_tasks t ON t.task_id=r.task_id WHERE r.run_id=?',principalId,runId);
    if(!row)throw missing();
    if(write&&row.membership==='viewer')throw new StorageError('FORBIDDEN',403,'A project operator or owner is required');
    return row;
  }
  function inspect(row:Row,plan:Draft,requireDelivery=true){
    const requirements=get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',row.run_id!,plan.requirementRevision);
    if(!requirements)throw missing();
    const facts=parseContract(productOutput,JSON.parse(String(requirements.content_json)));
    return inspectPlan(plan,{
      requirementIds:new Set(facts.requirements.map(r=>r.id)),requireDelivery,
      hasArtifact:ref=>!!get(`SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash
        WHERE a.run_id=? AND a.artifact_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'`,row.run_id!,ref.artifactId,ref.sha256),
    });
  }
  function pendingQuestions(runId:string){
    return !!get(`SELECT 1 FROM clarification_current c JOIN clarification_questions q ON q.run_id=c.run_id
      AND q.question_id=c.question_id AND q.revision=c.question_revision WHERE c.run_id=? AND c.state='OPEN'
      AND json_extract(q.content_json,'$.required')=1`,runId);
  }
  function pendingInterpretation(runId:string,requirementRevision:number){
    return !!get(`SELECT 1 FROM preparation_jobs WHERE run_id=? AND purpose='INTERPRET' AND state NOT IN ('APPLIED','SUPERSEDED')
      AND json_extract(basis_json,'$.requirementRevision')=?`,runId,requirementRevision);
  }
  function pendingSource(runId:string,requirementRevision:number){
    return !!get(`SELECT 1 FROM understanding_revisions u WHERE u.run_id=? AND u.requirement_revision=? AND EXISTS(
      SELECT 1 FROM input_processing p JOIN input_messages m ON m.message_id=p.message_id JOIN operations o ON o.operation_id=p.operation_id
      WHERE m.run_id=u.run_id AND o.status IN ('WAITING','RUNNING','OUTCOME_UNKNOWN'))`,runId,requirementRevision);
  }
  function getPlanReview(input:Parsed<'getPlanReview'>){
    const row=authorized(input.principalId,input.runId),revision=input.planRevision??row.current_plan_revision;
    const published=get('SELECT * FROM plan_revisions WHERE run_id=? AND revision=?',input.runId,revision??null);
    if(!published)throw missing();
    const plan=parseContract(planDraft,JSON.parse(String(published.content_json)));
    const saved=get('SELECT actor,operation_id,created_at FROM plan_confirmations WHERE run_id=? AND plan_revision=?',input.runId,revision??null);
    const confirmation=saved?{actor:saved.actor,operationId:saved.operation_id,confirmedAt:saved.created_at}:null;
    const current=revision===row.current_plan_revision&&published.requirement_revision===row.current_requirement_revision;
    const graph=inspect(row,plan);
    const repair=get("SELECT basis_json,carry_json FROM verified_repairs WHERE run_id=? AND published_plan_revision=? AND state='PUBLISHED'",input.runId,revision??null),carried=repair?JSON.parse(String(repair.carry_json)) as CarriedResult[]:undefined,repairBasis=repair?JSON.parse(String(repair.basis_json)) as {round:number;planRevision:number;issues:{issueId:string;revision:number;state:string;failureSha256:string}[]}:undefined;
    const carryCurrent=!carried||carried.every(fact=>!!createPlanResults(db).resolve(input.runId,Number(revision),fact.workId,false))&&(confirmation!==null||repairBasis!.issues.every(issue=>{const actual=get('SELECT i.revision,i.state,f.failure_sha256 FROM issues i JOIN verified_findings f ON f.issue_id=i.issue_id WHERE i.issue_id=? AND i.run_id=?',issue.issueId,input.runId);return actual?.revision===issue.revision&&actual.state===issue.state&&actual.failure_sha256===issue.failureSha256;}));
    const canConfirm=current&&!confirmation&&carryCurrent&&row.membership!=='viewer'&&row.terminal_outcome===null&&['OPEN','PAUSED'].includes(String(row.control_gate))&&graph.issues.length===0&&
      !pendingQuestions(input.runId)&&!pendingInterpretation(input.runId,plan.requirementRevision)&&!pendingSource(input.runId,plan.requirementRevision);
    return parseContract(planReviewView,{projectId:row.project_id,runId:input.runId,resourceRevision:row.resource_revision,planRevision:revision,
      requirementRevision:published.requirement_revision,reviewHash:published.content_hash,baseCommit:row.base_commit,
      plan,mode:current?'current':'history',canConfirm,confirmation,topology:graph.topology,issues:[...graph.issues,...(!carryCurrent?[{code:'PLAN_CARRY_CHANGED',path:'carryForward'}]:[])].slice(0,100),
      ...(carried?{carryForward:{sha256:digest(canonical(carried)),round:repairBasis!.round,sourcePlanRevision:repairBasis!.planRevision,results:carried.map(fact=>({workId:fact.workId,workRevision:fact.workRevision,attemptId:fact.attemptId,sourcePlanRevision:fact.sourcePlanRevision,outcome:fact.outcome,codeCommit:fact.codeCommit,evidence:fact.evidence,checkConfigHash:fact.checkConfigHash,templateVersion:fact.templateVersion,inputManifestSha256:fact.inputManifestSha256,snapshotSha256:digest(canonical(fact)),origin:fact.workVerification?'FORMAL':'HISTORICAL'}))}}:{})});
  }
  return {authorized,inspect,pendingQuestions,pendingInterpretation,pendingSource,getPlanReview};
}
