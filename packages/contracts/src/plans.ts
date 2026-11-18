import { z } from 'zod';
import { planDraft } from './outputs.js';
import { artifactRef,gitCommit, ids, opaqueKey, revision, sha256, timestamp } from './primitives.js';

export const planIssue = z.strictObject({
  code: opaqueKey, path: z.string().min(1).max(512), workId: ids.work.optional(),
  relatedWorkId: ids.work.optional(), requirementId: ids.requirement.optional(),
});
export type PlanIssue = z.output<typeof planIssue>;
export const planReviewView = z.strictObject({
  projectId: ids.project, runId: ids.run, resourceRevision: revision, planRevision: revision,
  requirementRevision: revision, reviewHash: sha256, baseCommit: gitCommit,
  plan: planDraft, mode: z.enum(['current','history']), canConfirm: z.boolean(),
  confirmation: z.strictObject({actor:opaqueKey,operationId:ids.operation,confirmedAt:timestamp}).nullable(),
  executionAuthorization:z.strictObject({authorizationId:opaqueKey,authorizedAt:timestamp}).nullable().optional(),
  issues: z.array(planIssue),
  topology: z.array(z.strictObject({workId:ids.work,layer:z.number().int().min(0).max(29)})).max(30),
  carryForward:z.strictObject({sha256,round:z.number().int().min(1).max(2),sourcePlanRevision:revision,results:z.array(z.strictObject({
    workId:ids.work,workRevision:revision,attemptId:ids.attempt,sourcePlanRevision:revision,
    outcome:z.enum(['success','completed-with-findings']),codeCommit:gitCommit.nullable(),evidence:artifactRef,
    checkConfigHash:sha256,templateVersion:opaqueKey,inputManifestSha256:sha256,snapshotSha256:sha256,
    origin:z.enum(['FORMAL','HISTORICAL']),
  })).max(30)}).optional(),
});

export type Draft = z.output<typeof planDraft>;
export interface PlanFacts {
  requirementIds: ReadonlySet<string>;
  hasArtifact(ref:{artifactId:string;sha256:string}):boolean;
  /** Older trusted snapshots can be inspected even before delivery checks are available. */
  requireDelivery?:boolean;
  roleLimits?:ReadonlyMap<string,{cpu:number;memoryMiB:number;timeoutMs:number}>;
}
const intersects=(a:string,b:string)=>a===b||a.startsWith(b+'/')||b.startsWith(a+'/');
const sortKey=(a:string,b:string)=>a<b?-1:a>b?1:0;

/** Validate a bounded declarative graph; capability and content facts come from the caller's snapshot. */
export function inspectPlan(plan:Draft,facts:PlanFacts){
  const issues:PlanIssue[]=[],works=new Map<string,Draft['works'][number]>(),order=new Map<string,number>();
  const used=new Set<string>(),verified=new Set<string>();
  const add=(code:string,path:string,workId?:Draft['works'][number]['workId'],relatedWorkId?:Draft['works'][number]['workId'])=>{
    issues.push({code,path,...(workId?{workId}:{}),...(relatedWorkId?{relatedWorkId}:{})});
  };
  for(const [i,w] of plan.works.entries()){
    if(works.has(w.workId))add('WORK_ID_DUPLICATE',`works.${i}.workId`,w.workId);
    else{works.set(w.workId,w);order.set(w.workId,i);}
  }
  for(const [i,w] of plan.works.entries()){
    const path=`works.${i}`,deps=new Set<string>(),slots=new Map<string,string>(),requires=new Set<string>();
    for(const [j,dep] of w.dependencies.entries()){
      if(!works.has(dep.workId)||dep.workId===w.workId)add('DEPENDENCY_INVALID',`${path}.dependencies.${j}`,w.workId,dep.workId);
      if(deps.has(dep.workId))add('DEPENDENCY_DUPLICATE',`${path}.dependencies.${j}`,w.workId,dep.workId);
      deps.add(dep.workId);
    }
    for(const [j,slot] of w.outputSpec.entries()){
      if(slots.has(slot.slot))add('OUTPUT_SLOT_DUPLICATE',`${path}.outputSpec.${j}`,w.workId);
      slots.set(slot.slot,slot.schemaId);
    }
    for(const [j,input] of w.inputRefs.entries()){
      if(input.kind==='artifact'?!facts.hasArtifact(input):!deps.has(input.workId)||!works.get(input.workId)?.outputSpec.some(s=>s.slot===input.outputSlot))
        add('WORK_INPUT_UNRESOLVED',`${path}.inputRefs.${j}`,w.workId,input.kind==='output'?input.workId:undefined);
    }
    for(const [j,check] of w.completionChecks.entries()){
      if('outputSlot' in check&&(!slots.has(check.outputSlot)||check.kind==='schema-valid'&&slots.get(check.outputSlot)!==check.schemaId))
        add('CHECK_OUTPUT_INVALID',`${path}.completionChecks.${j}`,w.workId);
    }
    const tests=w.role==='tester'&&w.completionChecks.some(check=>check.kind==='required-tests-pass');
    for(const [j,req] of w.requirementIds.entries()){
      if(!facts.requirementIds.has(req)||requires.has(req))add('WORK_REQUIREMENT_INVALID',`${path}.requirementIds.${j}`,w.workId);
      requires.add(req);used.add(req);
      if(tests)verified.add(req);
    }
    if(w.role!=='developer'&&w.writeScope.length)add('ROLE_WRITE_DENIED',`${path}.writeScope`,w.workId);
    const limit=facts.roleLimits?.get(w.role),r=w.estimatedResources;
    if(facts.roleLimits&&(!limit||r.cpu>limit.cpu||r.memoryMiB>limit.memoryMiB||r.timeoutMs>limit.timeoutMs))add('ROLE_RESOURCE_UNAVAILABLE',`${path}.estimatedResources`,w.workId);
  }
  const layers=new Map<string,number>(),ancestors=new Map<string,Set<string>>(),active=new Set<string>();
  function visit(w:Draft['works'][number]){
    if(active.has(w.workId)){add('DAG_CYCLE',`works.${order.get(w.workId)}.dependencies`,w.workId);return;}
    if(layers.has(w.workId))return;
    active.add(w.workId);
    const dependencies=new Set<string>();let layer=0;
    for(const edge of w.dependencies){
      const parent=works.get(edge.workId);if(!parent)continue;
      visit(parent);dependencies.add(edge.workId);
      for(const id of ancestors.get(edge.workId)??[])dependencies.add(id);
      layer=Math.max(layer,(layers.get(edge.workId)??-1)+1);
    }
    active.delete(w.workId);layers.set(w.workId,layer);ancestors.set(w.workId,dependencies);
  }
  for(const w of works.values())visit(w);
  for(const [i,a] of plan.works.entries())for(const b of plan.works.slice(i+1)){
    if(!ancestors.get(a.workId)?.has(b.workId)&&!ancestors.get(b.workId)?.has(a.workId)&&a.writeScope.some(x=>b.writeScope.some(y=>intersects(x.toLowerCase(),y.toLowerCase()))))
      add('WRITE_SCOPE_OVERLAP',`works.${i}.writeScope`,a.workId,b.workId);
  }
  if(facts.requireDelivery)for(const [i,w] of plan.works.entries()){
    if(w.role==='tester'&&w.completionChecks.some(c=>c.kind==='required-tests-pass')){
      const hasCommit=w.dependencies.some(d=>d.requiredOutcome==='success'&&works.get(d.workId)?.completionChecks.some(c=>c.kind==='commit-resolved'));
      if(!hasCommit)add('VERIFICATION_BASIS_MISSING',`works.${i}.dependencies`,w.workId);
    }
  }
  for(const requirementId of facts.requirementIds as ReadonlySet<NonNullable<PlanIssue['requirementId']>>){
    if(!used.has(requirementId))issues.push({code:'REQUIREMENT_UNCOVERED',path:'works',requirementId});
    if(facts.requireDelivery&&!verified.has(requirementId))issues.push({code:'REQUIRED_TEST_MISSING',path:'works',requirementId});
  }
  if(facts.requireDelivery&&plan.works.some(w=>w.writeScope.length)&&!plan.works.some(w=>w.role==='developer'&&w.completionChecks.some(c=>c.kind==='commit-resolved')))add('INTEGRATION_OUTPUT_MISSING','works');
  const topology=issues.some(i=>i.code==='DAG_CYCLE')?[]:[...works.values()].map(w=>({workId:w.workId,layer:layers.get(w.workId)??0})).sort((a,b)=>a.layer-b.layer||sortKey(a.workId,b.workId));
  return {issues,topology};
}
