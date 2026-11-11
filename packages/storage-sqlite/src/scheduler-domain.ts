import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { ids, inputManifest, parseContract, planDraft, productOutput } from '@devmesh/contracts';
import type { Draft } from '@devmesh/contracts';
import { StorageError } from './errors.js';
import { canonical } from './json.js';
import { digest } from './migrations.js';
import type { Parsed, ScheduledCandidate } from './protocol.js';
import type { createPlanDomain } from './plan-domain.js';
import type {createCandidateIntegrationDomain} from './candidate-integration-domain.js';

type Row=Record<string,string|number|null>;
type Work=Draft['works'][number];
type Admission=Parsed<'admitScheduledWork'>;
function reject(code:string,message:string,status=409):never{throw new StorageError(code,status,message);}
const json=(v:unknown)=>JSON.parse(String(v)) as unknown;
export function createSchedulerDomain(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>,candidates:ReturnType<typeof createCandidateIntegrationDomain>){
  const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as Row|undefined;
  const all=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as Row[];
  const exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
  const readyArtifact=(runId:string,ref:{artifactId:string;sha256:string})=>!!get(`SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash
    WHERE a.run_id=? AND a.artifact_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'`,runId,ref.artifactId,ref.sha256);
  function workBasis(runId:string,planRevision:number,workId:string){
    const row=get(`SELECT w.work_epoch,w.blocked_reason,rev.definition_json FROM plan_works p JOIN works w ON w.run_id=p.run_id AND w.work_id=p.work_id
      JOIN work_revisions rev ON rev.run_id=p.run_id AND rev.work_id=p.work_id AND rev.revision=p.work_revision
      WHERE p.run_id=? AND p.plan_revision=? AND p.work_id=?`,runId,planRevision,workId);
    if(!row)reject('WORK_BASIS_CHANGED','Current plan no longer contains the work');
    return row;
  }
  function dependencies(runId:string,planRevision:number,work:Work){
    const results=new Map<string,Row>();
    for(const edge of work.dependencies){
      const result=get(`SELECT v.*,a.state FROM plan_works p JOIN attempts a ON a.run_id=p.run_id AND a.work_id=p.work_id
        AND a.work_revision=p.work_revision JOIN scheduled_work s ON s.attempt_id=a.attempt_id AND s.plan_revision=p.plan_revision
        JOIN verified_work_results v ON v.attempt_id=a.attempt_id WHERE p.run_id=? AND p.plan_revision=? AND p.work_id=?
        AND a.attempt_no=(SELECT MAX(newest.attempt_no) FROM attempts newest WHERE newest.run_id=a.run_id AND newest.work_id=a.work_id)
        ORDER BY a.attempt_no DESC LIMIT 1`,runId,planRevision,edge.workId);
      const verified=result&&(result.state==='SUCCEEDED'&&result.outcome==='success'||result.state==='FAILED'&&result.outcome==='completed-with-findings'&&edge.requiredOutcome==='completed-with-findings');
      if(!verified||!result)return null;
      results.set(edge.workId,result);
    }
    return results;
  }
  function freeRoles(runId:string){
    return new Set(all('SELECT role FROM role_slots WHERE run_id=? UNION ALL SELECT role FROM preparation_slots WHERE run_id=?',runId,runId).map(r=>String(r.role)));
  }
  function hasAttempt(runId:string,work:Work){
    return !!get('SELECT 1 FROM attempts WHERE run_id=? AND work_id=? AND (ended_at IS NULL OR work_revision=?)',runId,work.workId,work.workRevision);
  }
  function touch(projectId:string){
    const turn=Number(get('SELECT MAX(turn) AS turn FROM scheduler_project_turns')?.turn??0)+1;
    exec('INSERT INTO scheduler_project_turns VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET turn=excluded.turn',projectId,turn);
  }
  function defer(input:Parsed<'deferScheduledWork'>){
    const row=get('SELECT project_id FROM runs WHERE run_id=? AND resource_revision=? AND terminal_outcome IS NULL AND control_gate=\'OPEN\'',input.runId,input.resourceRevision);
    if(!row)return {deferred:false};
    touch(String(row.project_id));return {deferred:true};
  }
  function next(input:Parsed<'nextScheduledWork'>):ScheduledCandidate[]{
    const candidates:ScheduledCandidate[]=[];
    // Bound each read. Only consider runs with at least one slot and unused Work.
    const runs=all(`SELECT r.*,p.owner_id,p.updated_at,pr.content_json
      FROM runs r JOIN projects p ON p.project_id=r.project_id
      JOIN project_members m ON m.project_id=p.project_id AND m.principal_id=p.owner_id AND m.role='owner'
      JOIN plan_revisions pr ON pr.run_id=r.run_id AND pr.revision=r.current_plan_revision AND pr.requirement_revision=r.current_requirement_revision
      JOIN plan_confirmations c ON c.run_id=r.run_id AND c.plan_revision=pr.revision AND c.requirement_revision=pr.requirement_revision
      LEFT JOIN scheduler_project_turns q ON q.project_id=r.project_id
      LEFT JOIN scheduler_run_budget b ON b.run_id=r.run_id
      WHERE r.control_gate='OPEN' AND r.terminal_outcome IS NULL
      AND (b.run_id IS NULL OR b.admitted_attempts<b.maximum_attempts AND b.reserved_ms<b.maximum_reserved_ms)
      AND (SELECT COUNT(*) FROM role_slots WHERE run_id=r.run_id)+(SELECT COUNT(*) FROM preparation_slots WHERE run_id=r.run_id)<2
      AND EXISTS(SELECT 1 FROM plan_works pw JOIN works w ON w.run_id=pw.run_id AND w.work_id=pw.work_id
        WHERE pw.run_id=r.run_id AND pw.plan_revision=pr.revision AND w.blocked_reason IS NULL AND NOT EXISTS(
          SELECT 1 FROM attempts a WHERE a.run_id=pw.run_id AND a.work_id=pw.work_id AND (a.ended_at IS NULL OR a.work_revision=pw.work_revision)))
      ORDER BY COALESCE(q.turn,0),r.created_at,r.run_id LIMIT ?`,Math.min(input.limit*4,400));
    for(const row of runs){
      const runId=String(row.run_id),planRevision=Number(row.current_plan_revision),occupied=freeRoles(runId);
      if(plans.pendingQuestions(runId)||plans.pendingInterpretation(runId,Number(row.current_requirement_revision))||
        plans.pendingSource(runId,Number(row.current_requirement_revision))){touch(String(row.project_id));continue;}
      const plan=parseContract(planDraft,json(row.content_json)),graph=plans.inspect(row,plan);
      if(graph.issues.length){touch(String(row.project_id));continue;}
      const items=new Map(plan.works.map(w=>[w.workId,w]));
      const before=candidates.length;
      for(const {workId} of graph.topology){
        const work=items.get(workId)!;
        if(occupied.has(work.role)||hasAttempt(runId,work)||!dependencies(runId,planRevision,work))continue;
        const w=workBasis(runId,planRevision,workId);
        if(w.blocked_reason!==null)continue;
        candidates.push({projectId:String(row.project_id),runId,principalId:String(row.owner_id),runEpoch:Number(row.run_epoch),
          resourceRevision:Number(row.resource_revision),planRevision,workEpoch:Number(w.work_epoch),work});
        break;
      }
      if(candidates.length===before)touch(String(row.project_id));
      if(candidates.length>=input.limit)break;
    }
    return candidates;
  }
  function currentManifest(input:Admission,run:Row){
    const plan=get('SELECT content_json FROM plan_revisions WHERE run_id=? AND revision=?',input.runId,input.planRevision);
    if(!plan||run.current_plan_revision!==input.planRevision)reject('PLAN_SUPERSEDED','Plan changed before scheduling');
    if(!get('SELECT 1 FROM registry_control WHERE active_generation_id=?',input.work.endpoint.registryGenerationId))reject('REGISTRY_BINDING_CHANGED','Scheduler requires a committed endpoint generation');
    const endpoint=get('SELECT config_json FROM endpoint_registrations WHERE endpoint_id=? AND revision=?',input.work.endpoint.endpointId,input.work.endpoint.revision);
    const config=endpoint?json(endpoint.config_json) as {hosting?:string;allowedCallers?:string[];supportedSkills?:string[]}:null;
    if(config?.hosting!=='local'||!config.allowedCallers?.includes(input.callerId)||!config.supportedSkills?.includes('devmesh.work.'+input.work.roleSnapshot.role))
      reject('SCHEDULER_ENDPOINT_DENIED','Endpoint is not enabled for this service and role');
    const draft=parseContract(planDraft,json(plan.content_json)),graph=plans.inspect(run,draft);
    if(graph.issues.length)throw new StorageError('PLAN_INVALID',422,'Plan checks no longer pass',{issues:graph.issues.slice(0,100)});
    const work=draft.works.find(w=>w.workId===input.work.workId);
    if(!work||work.workRevision!==input.work.workRevision||hasAttempt(input.runId,work))reject('WORK_BASIS_CHANGED','Original work already has an attempt or changed revision');
    const dep=dependencies(input.runId,input.planRevision,work),occupied=freeRoles(input.runId);
    if(!dep)reject('DEPENDENCY_UNSATISFIED','Current predecessor has no verified outcome');
    if(occupied.size>=2||occupied.has(work.role))reject('ROLE_CAPACITY_EXHAUSTED','Run role slots are occupied');
    const prompt=get(`SELECT a.content_hash FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.project_id=? AND
      a.artifact_id=? AND a.state='READY' AND c.state='READY'`,run.project_id!,input.work.roleSnapshot.promptArtifactId);
    if(!prompt)reject('ROLE_PROMPT_UNAVAILABLE','Role prompt must be a ready artifact in this project');
    const refs=new Map<string,{artifactId:string;sha256:string}>();
    for(const ref of work.inputRefs){
      const source=ref.kind==='artifact'?ref:(json(dep.get(ref.workId)!.outputs_json) as {slot:string;ref:{artifactId:string;sha256:string}}[]).find(x=>x.slot===ref.outputSlot)?.ref;
      if(!source||!readyArtifact(input.runId,source))reject('WORK_INPUT_UNAVAILABLE','A frozen Work input is unavailable');
      refs.set(source.artifactId,{artifactId:source.artifactId,sha256:source.sha256});
    }
    const bases=new Set([...dep.values()].map(r=>r.code_commit as string|null).filter((x):x is string=>x!==null));
    let codeCommit:string;
    if(get("SELECT 1 FROM managed_repositories WHERE project_id=? AND state='READY'",run.project_id!)){
      // This executes within the existing admission transaction. Calling the
      // public command here would open a nested SQLite transaction.
      const subject={principalId:input.meta.principalId,runId:input.runId,purpose:'work-input' as const,workId:work.workId},basis=candidates.basis.freeze(subject);
      if(work.role==='tester'&&basis.sources.length===0)reject('VERIFICATION_BASIS_UNAVAILABLE','Tester requires a verified development source');
      const snapshot=basis.sources.length?candidates.qualified(subject):null;
      if(snapshot&&(!snapshot.manifest||snapshot.purpose!=='work-input'||snapshot.workId!==work.workId||snapshot.basisSha256!==basis.sha256))reject('CANDIDATE_SNAPSHOT_UNAVAILABLE','Work requires its exact current dependency snapshot');
      codeCommit=snapshot?.manifest?.commit??basis.baseCommit;
    }else{
      if(bases.size>1)reject('CODE_BASIS_AMBIGUOUS','Predecessor outputs require an integrated code snapshot');
      codeCommit=[...bases][0]??String(get('SELECT base_commit FROM user_tasks WHERE task_id=?',run.task_id!)!.base_commit);
      if(work.role==='tester'&&bases.size===0)reject('VERIFICATION_BASIS_UNAVAILABLE','Tester requires a verified code snapshot from its predecessor');
    }
    const req=get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',input.runId,draft.requirementRevision)!;
    const requirements=parseContract(productOutput,json(req.content_json)).requirements;
    const decision=get('SELECT decision_id FROM decisions WHERE run_id=? AND subject_kind=\'PLAN\' AND subject_id=?',input.runId,String(input.planRevision));
    if(!decision)reject('PLAN_NOT_CONFIRMED','An explicit Plan decision is required');
    const manifest=parseContract(inputManifest,{schemaVersion:'devmesh.input-manifest.v1',
      requirements:requirements.filter(r=>work.requirementIds.includes(r.id)).map(r=>({requirementId:r.id,sha256:digest(canonical(r))})),
      interfaces:[],artifacts:[...refs.values()],codeCommit,templateVersion:input.templateVersion,
      checkConfigHash:input.checkConfigHash,decisionIds:[decision.decision_id]});
    return {manifest,work,promptHash:String(prompt.content_hash)};
  }
  function reserve(input:Admission,run:Row,work:Work,promptHash:string){
    const estimate=work.estimatedResources,limits=input.runnerLimits;
    if(estimate.cpu>limits.cpu||estimate.memoryMiB>limits.memoryMiB||estimate.timeoutMs>limits.timeoutMs)
      reject('RUNNER_RESOURCE_UNAVAILABLE','Work exceeds the configured Runner resource limits');
    const capacity=Number(get(`SELECT COUNT(*) AS n FROM scheduled_work s JOIN attempts a ON a.attempt_id=s.attempt_id
      WHERE s.runner_id=? AND a.ended_at IS NULL`,input.runnerId)?.n??0);
    if(capacity>=input.runnerCapacity)reject('RUNNER_CAPACITY_EXHAUSTED','Runner capacity is occupied');
    exec('INSERT OR IGNORE INTO scheduler_run_budget(run_id,maximum_attempts,maximum_reserved_ms) VALUES(?,?,?)',input.runId,input.maximumAttempts,input.maximumReservedMs);
    const budget=get('SELECT * FROM scheduler_run_budget WHERE run_id=?',input.runId)!;
    if(budget.maximum_attempts!==input.maximumAttempts||budget.maximum_reserved_ms!==input.maximumReservedMs)
      reject('SCHEDULER_BUDGET_CHANGED','Current Run has a frozen admission budget');
    if(Number(budget.admitted_attempts)>=input.maximumAttempts||Number(budget.reserved_ms)+work.estimatedResources.timeoutMs>input.maximumReservedMs)
      reject('SCHEDULER_BUDGET_EXHAUSTED','Run admission budget is exhausted');
    const {promptArtifactId:_prompt,...profile}=input.work.roleSnapshot;
    const policyHash=digest(canonical({profile,promptHash,endpoint:input.work.endpoint,callerId:input.callerId,templateVersion:input.templateVersion,
      checkConfigHash:input.checkConfigHash,runnerId:input.runnerId,runnerLimits:input.runnerLimits}));
    exec('INSERT OR IGNORE INTO scheduler_run_roles VALUES(?,?,?)',input.runId,work.role,policyHash);
    if(get('SELECT policy_hash FROM scheduler_run_roles WHERE run_id=? AND role=?',input.runId,work.role)?.policy_hash!==policyHash)
      reject('SCHEDULER_ROLE_POLICY_CHANGED','Current Run role policy is frozen');
    exec('UPDATE scheduler_run_budget SET admitted_attempts=admitted_attempts+1,reserved_ms=reserved_ms+? WHERE run_id=?',work.estimatedResources.timeoutMs,input.runId);
    touch(String(run.project_id));
  }
  function verify(input:Parsed<'recordVerifiedWork'>){
    const a=get('SELECT a.* FROM attempts a JOIN scheduled_work s ON s.attempt_id=a.attempt_id WHERE a.attempt_id=? AND a.run_id=?',input.attemptId,input.runId);
    if(!a||a.state!=='VERIFYING'||a.ended_at!==null)reject('ATTEMPT_STATE_CONFLICT','Only a scheduled verifying attempt can receive a final verification');
    if(!readyArtifact(input.runId,input.evidence))reject('VERIFICATION_EVIDENCE_UNAVAILABLE','Verification requires a ready evidence artifact');
    const w=get('SELECT definition_json FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?',input.runId,a.work_id!,a.work_revision!)!;
    if(!get(`SELECT 1 FROM scheduled_work s JOIN runs r ON r.run_id=s.run_id JOIN works w ON w.run_id=r.run_id
      AND w.work_id=? WHERE s.attempt_id=? AND r.current_plan_revision=s.plan_revision AND w.work_epoch=? AND w.blocked_reason IS NULL`,
      a.work_id!,input.attemptId,a.admitted_work_epoch!))reject('WORK_BASIS_CHANGED','Verification belongs to an obsolete work basis');
    const work=parseContract(planDraft,{requirementRevision:1,works:[json(w.definition_json)]}).works[0]!;
    const slots=new Set(work.outputSpec.map(s=>s.slot));
    if(new Set(input.outputs.map(x=>x.slot)).size!==input.outputs.length||input.outputs.some(x=>!slots.has(x.slot)||!readyArtifact(input.runId,x.ref))||
      input.outcome==='success'&&input.outputs.length!==slots.size||input.outcome==='completed-with-findings'&&work.role!=='tester')
      reject('VERIFICATION_OUTPUT_INVALID','Verified outputs do not match their Work definition',422);
    if(work.role==='developer'&&input.outcome==='success'&&!input.codeCommit)reject('VERIFICATION_BASIS_UNAVAILABLE','Verified development requires the resolved code commit');
    exec('INSERT INTO verified_work_results VALUES(?,?,?,?,?,?)',input.attemptId,input.outcome,input.evidence.artifactId,canonical(input.outputs),input.codeCommit,new Date().toISOString());
    return {a,workId:parseContract(ids.work,a.work_id)};
  }
  return {next,defer,currentManifest,reserve,verify};
}
