import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertResourceVersion,parseContract,productOutput,planDraft,qualityPolicy,ids} from '@devmesh/contracts';
import type {Meta,OperationResult} from './protocol.js';
import type {createReleaseFreezeDomain} from './release-freeze-domain.js';
import type {createPlanDomain} from './plan-domain.js';
import {candidateReviewRequests} from './candidate-review-protocol.js';
import type {CandidateReviewMethod,CandidateReviewInput,CandidateReviewItem,CandidateHumanResult,CandidateReviewView,CandidateRejectionResult} from './candidate-review-protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
type Row=Record<string,string|number|null>;
interface Hooks {
 operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize:()=>void):OperationResult;
 changed(runId:string,operationId:string,candidateId:string,resultId:string):void;
 rejected(runId:string,operationId:string,candidateId:string,rejectionId:string,resultId:string,state:'OPEN'|'WITHDRAWN'):void;
}
function fail(code:string,status=409):never{throw new StorageError(code,status,'Review requires an exact current candidate and explicit observations');}
const json=<T>(v:unknown):T=>JSON.parse(String(v)) as T;
export function createCandidateReviewDomain(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>,freezes:Pick<ReturnType<typeof createReleaseFreezeDomain>,'getCandidate'>,hooks:Hooks){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 function authorized(principalId:string,runId:string,write=false){const run=plans.authorized(principalId,runId);if(write&&run.membership!=='owner')fail('FORBIDDEN',403);return run;}
 function definitions(i:CandidateReviewInput<'getCandidateReview'>){
  const run=authorized(i.principalId,i.runId),candidate=freezes.getCandidate(i),body=candidate.manifest;
  const requirementRow=get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',i.runId,body.requirementRevision),planRow=get('SELECT content_json FROM plan_revisions WHERE run_id=? AND revision=?',i.runId,body.planRevision);
  if(!requirementRow||!planRow)fail('CANDIDATE_REVIEW_BASIS_MISSING');
  const requirements=parseContract(productOutput,json(requirementRow.content_json)),plan=parseContract(planDraft,json(planRow.content_json)),items:CandidateReviewItem[]=[];
  const add=(value:Omit<CandidateReviewItem,'itemId'|'itemHash'>)=>{const itemHash=digest(canonical(value));items.push({...value,itemHash,itemId:'review_'+digest(canonical({candidateId:i.candidateId,itemHash}))});};
  for(const r of requirements.requirements)for(const [index,expected] of r.acceptance.entries())add({kind:'requirement',requirementIds:[r.id],subjectId:r.id,checkId:'acceptance.'+index,expected});
  for(const w of body.works.filter(w=>w.relation==='MANUAL_PENDING')){
   const definition=plan.works.find(p=>p.workId===w.workId&&p.workRevision===w.workRevision);if(!definition)fail('CANDIDATE_REVIEW_BASIS_MISSING');
   for(const check of definition.completionChecks)if(check.kind==='human-decision')add({kind:'work-human',requirementIds:[...definition.requirementIds].sort(),subjectId:w.operationId,checkId:check.checkId,expected:'确认工作 '+w.workId+' 的人工检查 '+check.checkId+' 满足已确认计划。'});
  }
  const automaticChecks:CandidateReviewView['automaticChecks']=[];
  for(const q of body.quality){
   const saved=get('SELECT policy_json FROM quality_policies WHERE config_hash=? AND project_id=?',q.verification.configHash,body.projectId);if(!saved)fail('CANDIDATE_REVIEW_BASIS_MISSING');
   const policy=parseContract(qualityPolicy,json(saved.policy_json));
   for(const c of q.verification.evaluation!.checks){const check=policy.checks.find(p=>p.checkId===c.checkId);if(!check)fail('CANDIDATE_REVIEW_BASIS_MISSING');
    if(check.kind==='human')add({kind:'quality-human',requirementIds:[...new Set(body.works.filter(w=>w.assessment.qualityOperationId===q.verification.operationId).flatMap(w=>plan.works.find(p=>p.workId===w.workId)!.requirementIds))].sort(),subjectId:q.verification.operationId,checkId:c.checkId,expected:'确认质量检查 '+c.checkId+' 满足本候选已冻结的需求与质量策略。'});
    else automaticChecks.push({operationId:q.verification.operationId,checkId:c.checkId,status:c.status,codes:c.codes});
   }
  }
  items.sort((a,b)=>a.itemId<b.itemId?-1:a.itemId>b.itemId?1:0);
  if(!items.length||items.length>2048||new Set(items.map(v=>v.itemId)).size!==items.length||Buffer.byteLength(canonical(items))>512*1024)fail('CANDIDATE_REVIEW_LIMIT');
  return {run,candidate,items,automaticChecks};
 }
 const result=(id:string)=>json<CandidateHumanResult>((get('SELECT result_json FROM candidate_review_results WHERE result_id=?',id)??fail('CANDIDATE_REVIEW_NOT_FOUND',404)).result_json);
 const rejection=(id:string)=>json<CandidateRejectionResult>((get('SELECT result_json FROM candidate_rejection_results WHERE result_id=?',id)??fail('CANDIDATE_REJECTION_NOT_FOUND',404)).result_json);
 function view(i:CandidateReviewInput<'getCandidateReview'>):CandidateReviewView {
  const d=definitions(i),saved=new Map(all('SELECT item_id,result_id FROM candidate_review_current WHERE candidate_id=?',i.candidateId).map(r=>[String(r.item_id),String(r.result_id)]));
  const items=d.items.map(item=>{const r=saved.has(item.itemId)?result(saved.get(item.itemId)!):null;const available=!r||r.evidence.every(ref=>!!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.content_hash=? AND a.project_id=? AND a.run_id=? AND a.state='READY' AND c.state='READY'",ref.artifactId,ref.sha256,d.candidate.projectId,i.runId));return {...item,status:d.candidate.qualification==='STALE'||r&&(!available||r.item.itemHash!==item.itemHash)?'STALE' as const:r?.verdict??'MISSING' as const,result:r};});
  const humanStatus=items.some(i=>i.status==='STALE')?'STALE':items.some(i=>i.status==='FAIL')?'FAIL':items.some(i=>i.status==='MISSING')?'MISSING':'PASS';
  const rejections=all('SELECT c.result_id FROM candidate_rejection_current c JOIN candidate_rejection_results r ON r.result_id=c.result_id WHERE r.run_id=? ORDER BY c.rejection_id',i.runId).map(r=>rejection(String(r.result_id)));if(rejections.length>100)fail('CANDIDATE_REVIEW_LIMIT');
  const rejectionStatus=rejections.some(r=>r.state==='OPEN')?'OPEN':'NONE';
  const basis={candidateId:i.candidateId,candidateRevision:d.candidate.revision,manifestHash:d.candidate.manifestHash,qualification:d.candidate.qualification,items:items.map(({itemId,itemHash,status,result})=>({itemId,itemHash,status,resultId:result?.resultId??null})),automaticChecks:d.automaticChecks,rejections:rejections.map(r=>({candidateId:r.candidateId,rejectionId:r.rejectionId,resultId:r.resultId,classification:r.classification,state:r.state}))};
  const canRecord=d.candidate.qualification==='CURRENT'&&d.run.terminal_outcome===null&&d.run.phase==='REVIEW'&&d.run.control_gate==='OPEN'&&d.run.membership==='owner';
  const value:CandidateReviewView={...basis,resourceRevision:Number(d.run.resource_revision),automaticStatus:'PASS',humanStatus,reviewHash:digest(canonical(basis)),items,automaticChecks:d.automaticChecks,rejections,rejectionStatus,canRecord,canPrepareAcceptance:canRecord&&humanStatus==='PASS'&&rejectionStatus==='NONE'};
  if(Buffer.byteLength(canonical(value))>1024*1024)fail('CANDIDATE_REVIEW_LIMIT');return value;
 }
 const handlers={
  getCandidateReview:view,
  recordCandidateRejection(i:CandidateReviewInput<'recordCandidateRejection'>){
   if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);const {meta,ifMatch:_match,...payload}=i;
   const op=hooks.operation(meta,'RecordCandidateRejection',payload,operationId=>{
    const principalId=meta.principalId,run=authorized(principalId,i.runId,true);assertResourceVersion(i.ifMatch,Number(run.resource_revision));const v=view({principalId,runId:i.runId,candidateId:i.candidateId}),previous=get('SELECT candidate_id,result_id FROM candidate_rejection_current WHERE rejection_id=?',i.rejectionId);
    if(previous&&previous.candidate_id!==i.candidateId)fail('CANDIDATE_REJECTION_NOT_FOUND',404);
    if((previous?.result_id??null)!==i.previousResultId)fail('CANDIDATE_REVIEW_CONFLICT');
    if(run.terminal_outcome!==null||run.phase!=='REVIEW'||run.control_gate!=='OPEN'||v.manifestHash!==i.manifestHash||i.state==='OPEN'&&!v.canRecord)fail('CANDIDATE_REVIEW_STALE');
    if(i.state==='WITHDRAWN'&&!previous)fail('CANDIDATE_REJECTION_INVALID',422);
    const item=i.itemId?v.items.find(item=>item.itemId===i.itemId):null;
    if(Boolean(i.itemId)!==Boolean(i.itemHash)||i.itemId&&(!item||item.itemHash!==i.itemHash)||i.classification==='IN_SCOPE_DEFECT'&&!item)fail('CANDIDATE_REVIEW_ITEM_CHANGED');
    if(new Set(i.evidence.map(r=>r.artifactId)).size!==i.evidence.length)fail('CANDIDATE_REVIEW_EVIDENCE_INVALID',422);
    for(const ref of i.evidence)if(!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.project_id=? AND a.run_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'",ref.artifactId,run.project_id!,i.runId,ref.sha256))fail('CANDIDATE_REVIEW_EVIDENCE_INVALID');
    const definition=item?(({status:_status,result:_result,...definition})=>definition)(item):null,resultId='rejection_result_'+randomUUID().replaceAll('-',''),createdAt=new Date().toISOString(),record:CandidateRejectionResult={resultId,operationId,candidateId:i.candidateId,candidateRevision:v.candidateRevision,manifestHash:v.manifestHash,rejectionId:i.rejectionId,previousResultId:i.previousResultId,classification:i.classification,state:i.state,item:definition,description:i.description,reason:i.reason,evidence:i.evidence,principalId,createdAt,nextAction:i.state==='WITHDRAWN'?'NONE':i.classification==='IN_SCOPE_DEFECT'?'REPAIR_REVIEW_REQUIRED':'CHANGE_REVIEW_REQUIRED',applicationState:'NOT_APPLIED'};
    exec('INSERT INTO candidate_rejection_results VALUES(?,?,?,?,?,?,?,?,?,?,?)',resultId,operationId,run.project_id!,i.runId,i.candidateId,i.rejectionId,i.previousResultId,i.classification,i.state,canonical(record),createdAt);
    for(const ref of i.evidence)exec('INSERT INTO candidate_rejection_evidence VALUES(?,?,?)',resultId,ref.artifactId,ref.sha256);
    exec('INSERT INTO candidate_rejection_current VALUES(?,?,?) ON CONFLICT(rejection_id) DO UPDATE SET result_id=excluded.result_id',i.rejectionId,i.candidateId,resultId);
    view({principalId,runId:i.runId,candidateId:i.candidateId});
    const latest=get('SELECT candidate_id FROM candidate_freezes WHERE run_id=? ORDER BY revision DESC LIMIT 1',i.runId);if(latest&&latest.candidate_id!==i.candidateId)view({principalId,runId:i.runId,candidateId:ids.candidate.parse(latest.candidate_id)});
    hooks.rejected(i.runId,operationId,i.candidateId,i.rejectionId,resultId,i.state);return {resultId};
   },()=>{authorized(meta.principalId,i.runId,true);});return rejection(String(op.result!.resultId));
  },
  recordCandidateReview(i:CandidateReviewInput<'recordCandidateReview'>){
   if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);
   const {meta,ifMatch:_match,...payload}=i;
   const op=hooks.operation(meta,'RecordCandidateReview',payload,operationId=>{
    const principalId=meta.principalId,run=authorized(principalId,i.runId,true);assertResourceVersion(i.ifMatch,Number(run.resource_revision));const v=view({principalId,runId:i.runId,candidateId:i.candidateId});
    if(!v.canRecord||v.manifestHash!==i.manifestHash)fail('CANDIDATE_REVIEW_STALE');const item=v.items.find(item=>item.itemId===i.itemId);if(!item||item.itemHash!==i.itemHash)fail('CANDIDATE_REVIEW_ITEM_CHANGED');
    if(item.expected!==i.expected)fail('CANDIDATE_REVIEW_EXPECTED_CHANGED');if((item.result?.resultId??null)!==i.previousResultId)fail('CANDIDATE_REVIEW_CONFLICT');
    if(new Set(i.evidence.map(r=>r.artifactId)).size!==i.evidence.length)fail('CANDIDATE_REVIEW_EVIDENCE_INVALID',422);
    for(const ref of i.evidence)if(!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.project_id=? AND a.run_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'",ref.artifactId,run.project_id!,i.runId,ref.sha256))fail('CANDIDATE_REVIEW_EVIDENCE_INVALID');
    const {status:_status,result:_result,...definition}=item,resultId='review_result_'+randomUUID().replaceAll('-',''),createdAt=new Date().toISOString(),record:CandidateHumanResult={resultId,operationId,candidateId:i.candidateId,candidateRevision:v.candidateRevision,manifestHash:v.manifestHash,item:definition,previousResultId:i.previousResultId,principalId,verdict:i.verdict,procedure:i.procedure,expected:i.expected,observed:i.observed,evidence:i.evidence,createdAt};
    exec('INSERT INTO candidate_review_results VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',resultId,operationId,run.project_id!,i.runId,i.candidateId,i.itemId,i.itemHash,i.previousResultId,principalId,i.verdict,canonical(record),createdAt);
    for(const ref of i.evidence)exec('INSERT INTO candidate_review_evidence VALUES(?,?,?)',resultId,ref.artifactId,ref.sha256);
    exec('INSERT INTO candidate_review_current VALUES(?,?,?) ON CONFLICT(candidate_id,item_id) DO UPDATE SET result_id=excluded.result_id',i.candidateId,i.itemId,resultId);
    view({principalId,runId:i.runId,candidateId:i.candidateId});
    hooks.changed(i.runId,operationId,i.candidateId,resultId);return {resultId};
   },()=>{authorized(meta.principalId,i.runId,true);});return result(String(op.result!.resultId));
  },
  listCandidateReviewHistory(i:CandidateReviewInput<'listCandidateReviewHistory'>){
   authorized(i.principalId,i.runId);freezes.getCandidate({principalId:i.principalId,runId:i.runId,candidateId:i.candidateId});
   const rows=all('SELECT rowid sequence,result_id FROM candidate_review_results WHERE candidate_id=? AND rowid>? AND (? IS NULL OR item_id=?) ORDER BY rowid LIMIT ?',i.candidateId,i.afterSequence,i.itemId??null,i.itemId??null,i.limit+1),items:{sequence:number;result:CandidateHumanResult}[]=[];let size=0;
   for(const row of rows.slice(0,i.limit)){const item={sequence:Number(row.sequence),result:result(String(row.result_id))},length=Buffer.byteLength(canonical(item));if(size+length>1024*1024)break;items.push(item);size+=length;}
   return {items,nextSequence:rows.length>items.length?items.at(-1)!.sequence:null};
  },
  listCandidateRejectionHistory(i:CandidateReviewInput<'listCandidateRejectionHistory'>){
   authorized(i.principalId,i.runId);freezes.getCandidate({principalId:i.principalId,runId:i.runId,candidateId:i.candidateId});const rows=all('SELECT rowid sequence,result_id FROM candidate_rejection_results WHERE candidate_id=? AND rowid>? AND (? IS NULL OR rejection_id=?) ORDER BY rowid LIMIT ?',i.candidateId,i.afterSequence,i.rejectionId??null,i.rejectionId??null,i.limit+1),items:{sequence:number;result:CandidateRejectionResult}[]=[];let size=0;
   for(const row of rows.slice(0,i.limit)){const item={sequence:Number(row.sequence),result:rejection(String(row.result_id))},length=Buffer.byteLength(canonical(item));if(size+length>1024*1024)break;items.push(item);size+=length;}
   return {items,nextSequence:rows.length>items.length?items.at(-1)!.sequence:null};
  },
 };
 return {getReview:view,execute(method:CandidateReviewMethod,input:unknown):unknown{const parsed=parseContract(candidateReviewRequests[method],input),call=()=>(handlers[method] as (i:unknown)=>unknown)(parsed);return ['recordCandidateReview','recordCandidateRejection'].includes(method)?call():transaction(db,call);}};
}
