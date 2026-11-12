import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract,planDraft,assertResourceVersion,inputManifest} from '@devmesh/contracts';
import type {Meta,OperationResult} from './protocol.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
import {knownAttemptEffects} from './work-effects.js';
import {createPlanResults} from './plan-results.js';
import type {createPlanDomain} from './plan-domain.js';
import type {createCandidateIntegrationDomain} from './candidate-integration-domain.js';
import type {createReleaseDeliveryDomain} from './release-delivery-domain.js';
import type {createWorkVerificationDomain} from './work-verification-domain.js';
import type {createQualityDomain} from './quality-domain.js';
import {releaseFreezeRequests} from './release-freeze-protocol.js';
import type {ReleaseFreezeMethod,ReleaseFreezeInput,ReleaseCandidateManifest,ReleaseCandidateRevision,CandidateWorkProof} from './release-freeze-protocol.js';
type Row=Record<string,string|number|null>;
type Input=ReleaseFreezeInput<'freezeReleaseCandidate'>;
interface Hooks {
 operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize?:()=>void):OperationResult;
 changed(runId:string,operationId:string,candidateId:string):void;
}
const json=<T>(value:unknown):T=>JSON.parse(String(value)) as T;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Release candidate requires complete exact original proofs');}
export function createReleaseFreezeDomain(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>,candidates:ReturnType<typeof createCandidateIntegrationDomain>,deliveries:Pick<ReturnType<typeof createReleaseDeliveryDomain>,'completionFacts'>,works:Pick<ReturnType<typeof createWorkVerificationDomain>,'frozenFacts'>,quality:Pick<ReturnType<typeof createQualityDomain>,'completionFacts'>,hooks:Hooks){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p),results=createPlanResults(db);
 function member(principalId:string,runId:string){if(!get('SELECT 1 FROM runs r JOIN project_members m ON m.project_id=r.project_id AND m.principal_id=? WHERE r.run_id=?',principalId,runId))fail('RELEASE_CANDIDATE_NOT_FOUND',404);}
 function capture(i:Input):ReleaseCandidateManifest {
  const principalId=i.meta.principalId,run=plans.authorized(principalId,i.runId,true),source=candidates.qualified({principalId,runId:i.runId,purpose:'run-candidate'}),basis=candidates.basis.freeze({principalId,runId:i.runId,purpose:'run-candidate'}),head=get('SELECT * FROM managed_candidate_heads WHERE run_id=?',i.runId);
  if(source.operationId!==i.integrationOperationId||source.state!=='ACKNOWLEDGED'||!source.manifest||head?.operation_id!==source.operationId||head.commit_sha!==source.manifest.commit||source.basisSha256!==basis.sha256)fail('RELEASE_CANDIDATE_SOURCE_CHANGED');
  if(get("SELECT 1 FROM candidate_integrations WHERE project_id=? AND state NOT IN ('ACKNOWLEDGED','CONFLICT','FAILED')",run.project_id!))fail('RELEASE_CANDIDATE_EFFECT_UNKNOWN');
  const delivery=deliveries.completionFacts(principalId,i.deliveryOperationId),d=delivery.delivery,b=d.basis;
  if(d.runId!==i.runId||b.runEpoch!==run.run_epoch||b.planRevision!==run.current_plan_revision||b.requirementRevision!==run.current_requirement_revision||b.targetCommit!==source.manifest.commit||b.sourceManifestSha256!==source.manifest.sha256)fail('RELEASE_CANDIDATE_DELIVERY_CHANGED');
  const plan=planDraft.parse(json(get('SELECT content_json FROM plan_revisions WHERE run_id=? AND revision=?',i.runId,run.current_plan_revision!)!.content_json)),proofs:CandidateWorkProof[]=[],manual=new Set<string>(),qualityFacts:ReleaseCandidateManifest['quality']=[];
  const ancestors=(workId:string)=>{const found=new Set<string>();function visit(id:string){const w=plan.works.find(w=>w.workId===id)!;for(const edge of w.dependencies)if(!found.has(edge.workId)){found.add(edge.workId);visit(edge.workId);}}visit(workId);return found;};
  const testers=plan.works.filter(w=>w.role==='tester'),finalTesters=new Set(testers.filter(w=>!testers.some(other=>other.workId!==w.workId&&ancestors(other.workId).has(w.workId))).map(w=>w.workId));
  if(!finalTesters.size)fail('RELEASE_CANDIDATE_QUALITY_MISSING');
  for(const work of plan.works){
   const resolved=results.resolve(i.runId,Number(run.current_plan_revision),work.workId),carried=resolved?.carry??null;
   let row=resolved?.row,proof:Row|undefined;
   if(row)proof=get("SELECT * FROM work_verifications WHERE attempt_id=? AND state='APPLIED' AND artifact_id=?",row.attempt_id!,row.evidence_artifact_id!);
   else {row=get('SELECT a.*,w.work_epoch current_work_epoch,w.blocked_reason,s.plan_revision source_plan_revision FROM attempts a JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id JOIN scheduled_work s ON s.attempt_id=a.attempt_id WHERE a.run_id=? AND a.work_id=? ORDER BY attempt_no DESC LIMIT 1',i.runId,work.workId);if(row)proof=get("SELECT * FROM work_verifications WHERE attempt_id=? AND state='READY' ORDER BY rowid DESC LIMIT 1",row.attempt_id!);}
   if(!row||!proof||row.work_revision!==work.workRevision||row.admitted_work_epoch!==row.current_work_epoch||row.blocked_reason!==null||row.role!==work.role)fail('RELEASE_CANDIDATE_WORK_UNVERIFIED');
   const fact=works.frozenFacts(principalId,String(proof.operation_id),!!carried),a=fact.assessment,manifest=inputManifest.parse(json(row.input_manifest_json));
   let relation:CandidateWorkProof['relation']=carried?'CARRIED':'CURRENT';
   if(fact.runId!==i.runId||a.workId!==work.workId||a.workRevision!==work.workRevision||a.inputFingerprint!==row.input_fingerprint||fact.attemptId!==row.attempt_id)fail('RELEASE_CANDIDATE_WORK_CHANGED');
   if(carried&&(!carried.workVerification||carried.workVerification.operationId!==fact.operationId||carried.workVerification.sha256!==fact.evidence.sha256))fail('RELEASE_CANDIDATE_WORK_UNVERIFIED');
   if(fact.state==='READY'){
    if(work.role!=='tester'||!finalTesters.has(work.workId)||carried||row.ended_at!==null||row.state!=='VERIFYING'||a.automaticStatus!=='PENDING'||a.outcome!==null||!a.checks.some(c=>c.status==='PENDING')||a.checks.some(c=>c.status!=='PASS'&&!(c.status==='PENDING'&&['human-decision','quality-review'].includes(c.kind)&&c.code==='HUMAN_DECISION_REQUIRED')))fail('RELEASE_CANDIDATE_WORK_UNVERIFIED');
    relation='MANUAL_PENDING';manual.add(String(row.attempt_id));
   }else if(row.ended_at===null||!(row.state==='SUCCEEDED'&&a.outcome==='success'&&a.automaticStatus==='PASS'||work.role==='tester'&&!finalTesters.has(work.workId)&&row.state==='FAILED'&&a.outcome==='completed-with-findings'))fail('RELEASE_CANDIDATE_WORK_UNVERIFIED');
   if(!carried&&(row.admitted_run_epoch!==run.run_epoch||row.source_plan_revision!==run.current_plan_revision))fail('RELEASE_CANDIDATE_WORK_CHANGED');
   if(['developer','tester'].includes(work.role)&&(manifest.checkConfigHash!==b.checkConfigHash||manifest.templateVersion!==b.templateVersion))fail('RELEASE_CANDIDATE_CONFIG_CHANGED');
   proofs.push({workId:work.workId,workRevision:work.workRevision,workEpoch:Number(row.current_work_epoch),attemptId:String(row.attempt_id),role:work.role,relation,operationId:fact.operationId,evidence:fact.evidence,assessment:a,inputManifestHash:digest(canonical(manifest)),roleSnapshotHash:digest(String(row.role_snapshot_json)),carryHash:carried?digest(canonical(carried)):null});
   if(finalTesters.has(work.workId)){
    if(carried||!a.qualityOperationId)fail('RELEASE_CANDIDATE_QUALITY_STALE');
    const q=quality.completionFacts(a.qualityOperationId,principalId,String(row.attempt_id)),v=q.verification;
    if(v.evaluation?.automaticStatus!=='PASS'||v.basis.targetCommit!==b.targetCommit||v.basis.allocationManifestSha256!==b.sourceManifestSha256||v.configHash!==b.checkConfigHash||q.policy.templateVersion!==b.templateVersion)fail('RELEASE_CANDIDATE_QUALITY_STALE');
    qualityFacts.push({verification:v,materials:q.materials});
   }
  }
  if(!qualityFacts.some(q=>q.verification.operationId===b.qualityOperationId))fail('RELEASE_CANDIDATE_DELIVERY_CHANGED');
  for(const a of all('SELECT attempt_id,ended_at FROM attempts WHERE run_id=?',i.runId))if(a.ended_at===null&&!manual.has(String(a.attempt_id))||!knownAttemptEffects(db,String(a.attempt_id)))fail('RELEASE_CANDIDATE_EFFECT_UNKNOWN');
  if(get("SELECT 1 FROM runtime_activations r JOIN attempts a ON a.attempt_id=r.attempt_id WHERE a.run_id=? AND r.state NOT IN ('FINISHED','FAILED')",i.runId)||get("SELECT 1 FROM preparation_jobs WHERE run_id=? AND state NOT IN ('APPLIED','FAILED','SUPERSEDED')",i.runId)||get('SELECT 1 FROM preparation_attempts WHERE run_id=? AND ended_at IS NULL',i.runId)||get("SELECT 1 FROM preparation_steps s JOIN preparation_attempts a ON a.preparation_attempt_id=s.preparation_attempt_id WHERE a.run_id=? AND s.state IN ('SENT','RECONCILE')",i.runId))fail('RELEASE_CANDIDATE_EFFECT_UNKNOWN');
  const issues=all('SELECT issue_id,revision,state,severity FROM issues WHERE run_id=? ORDER BY issue_id',i.runId);
  if(issues.some(v=>['HIGH','CRITICAL'].includes(String(v.severity))&&v.state!=='VERIFIED'))fail('RELEASE_CANDIDATE_FINDING_UNRESOLVED');
  return {schemaVersion:'devmesh.release-candidate-manifest.v1',projectId:String(run.project_id),runId:i.runId,runEpoch:Number(run.run_epoch),requirementRevision:Number(run.current_requirement_revision),planRevision:Number(run.current_plan_revision),checkConfigHash:b.checkConfigHash,templateVersion:b.templateVersion,codeCommit:b.targetCommit,automaticStatus:'PASS',reviewStatus:manual.size||qualityFacts.some(q=>q.verification.evaluation?.reviewStatus==='PENDING')?'PENDING':'NOT_REQUIRED',source:{operationId:source.operationId,basis,manifestSha256:source.manifest.sha256},works:proofs,quality:qualityFacts,delivery:{record:d,materials:delivery.materials},issues:issues.map(v=>({issueId:String(v.issue_id),revision:Number(v.revision),state:String(v.state),severity:String(v.severity)}))};
 }
 const frozen=(candidateId:string,runId:string)=>get('SELECT f.*,c.manifest_json,c.manifest_hash FROM candidate_freezes f JOIN release_candidates c ON c.candidate_id=f.candidate_id WHERE f.candidate_id=? AND f.run_id=?',candidateId,runId)??fail('RELEASE_CANDIDATE_NOT_FOUND',404);
 function current(r:Row){if(get('SELECT 1 FROM candidate_freezes WHERE run_id=? AND revision>?',r.run_id!,r.revision!))return false;try{return digest(canonical(capture(json(r.request_json))))===r.basis_hash;}catch(error){if(error instanceof StorageError)return false;throw error;}}
 const view=(r:Row):ReleaseCandidateRevision=>({candidateId:String(r.candidate_id),operationId:String(r.operation_id),runId:String(r.run_id),projectId:String(r.project_id),revision:Number(r.revision),manifestHash:String(r.manifest_hash),createdAt:String(r.created_at),qualification:current(r)?'CURRENT':'STALE',manifest:json(r.manifest_json)});
 const handlers={
  freezeReleaseCandidate(i:Input){
   if(i.meta.scopeId!==i.runId)fail('OPERATION_SCOPE_INVALID',422);
   const {meta,ifMatch:_match,...payload}=i;
   const op=hooks.operation(meta,'FreezeReleaseCandidate',payload,operationId=>{
    const run=plans.authorized(meta.principalId,i.runId,true);assertResourceVersion(i.ifMatch,Number(run.resource_revision));const body=capture(i),text=canonical(body),hash=digest(text),id='candidate_'+randomUUID().replaceAll('-',''),revision=Number(get('SELECT COALESCE(MAX(revision),0) n FROM release_candidates WHERE run_id=?',i.runId)!.n)+1;
    if(Buffer.byteLength(text)>192*1024)fail('RELEASE_CANDIDATE_TOO_LARGE');
    exec("INSERT INTO release_candidates VALUES(?,?,?,?,?,?,?,?,?,?,?,'READY')",id,body.projectId,i.runId,revision,body.codeCommit,body.requirementRevision,body.planRevision,hash,body.checkConfigHash,digest(canonical(body.delivery.record.dataPlan)),text);
    exec('INSERT INTO candidate_freezes VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',operationId,meta.principalId,body.projectId,i.runId,id,revision,i.integrationOperationId,i.deliveryOperationId,digest(canonical(payload)),canonical(i),hash,new Date().toISOString());
    for(const w of body.works)exec('INSERT INTO candidate_freeze_work_proofs VALUES(?,?,?,?,?)',id,w.workId,w.operationId,w.evidence.sha256,w.relation);
    const materials=new Map<string,string>();for(const q of body.quality)for(const m of q.materials)materials.set('quality.'+q.verification.operationId+'.'+m.materialKey,m.contentHash!);for(const m of body.delivery.materials)materials.set('delivery.'+m.materialKey,m.contentHash!);
    for(const [key,contentHash] of materials)exec('INSERT INTO candidate_freeze_materials VALUES(?,?,?)',id,key,contentHash);
    hooks.changed(i.runId,operationId,id);return {candidateId:id,revision,manifestHash:hash};
   },()=>{plans.authorized(meta.principalId,i.runId,true);});
   return view(frozen(String(op.result!.candidateId),i.runId));
  },
  getReleaseCandidate(i:ReleaseFreezeInput<'getReleaseCandidate'>){member(i.principalId,i.runId);return view(frozen(i.candidateId,i.runId));},
  getCurrentReleaseCandidate(i:ReleaseFreezeInput<'getCurrentReleaseCandidate'>){member(i.principalId,i.runId);const r=get('SELECT candidate_id FROM candidate_freezes WHERE run_id=? ORDER BY revision DESC LIMIT 1',i.runId);return r?view(frozen(String(r.candidate_id),i.runId)):null;},
  listReleaseCandidates(i:ReleaseFreezeInput<'listReleaseCandidates'>){member(i.principalId,i.runId);const rows=all('SELECT candidate_id,revision FROM candidate_freezes WHERE run_id=? AND revision>? ORDER BY revision LIMIT ?',i.runId,i.afterRevision,i.limit+1),page=rows.slice(0,i.limit);return {items:page.map(r=>{const v=view(frozen(String(r.candidate_id),i.runId));return {candidateId:v.candidateId,operationId:v.operationId,revision:v.revision,manifestHash:v.manifestHash,createdAt:v.createdAt,qualification:v.qualification,codeCommit:v.manifest.codeCommit,automaticStatus:v.manifest.automaticStatus,reviewStatus:v.manifest.reviewStatus};}),nextRevision:rows.length>i.limit?Number(page.at(-1)!.revision):null};},
 };
 return {execute(method:ReleaseFreezeMethod,input:unknown):unknown{const parsed=parseContract(releaseFreezeRequests[method],input),call=()=>(handlers[method] as (i:unknown)=>unknown)(parsed);return method==='freezeReleaseCandidate'?call():transaction(db,call);}};
}
