import {createHash} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import {createCandidateBasis} from './candidate-basis.js';
import type {CandidateBasis,CandidateProof,CandidateSubject} from './candidate-basis.js';
import {candidateIntegrationRequests} from './candidate-integration-protocol.js';
import type {CandidateHead,CandidateIntegration,CandidateIntegrationInput,CandidateIntegrationMethod,CandidateIntegrationStep} from './candidate-integration-protocol.js';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import type {createPlanDomain} from './plan-domain.js';
import type {SourceManifest} from './workspace-protocol.js';

type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Candidate integration requires verified original facts');}
const same=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
const closed=(state:string)=>['ACKNOWLEDGED','CONFLICT','FAILED'].includes(state);

/** Private Worker journal. Filesystem proofs are supplied only by the trusted Git adapter. */
export function createCandidateIntegrationDomain(db:DatabaseSync,plans:ReturnType<typeof createPlanDomain>){
 const get=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).get(...params) as Row|undefined;
 const all=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).all(...params) as Row[];
 const exec=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).run(...params);
 const required=(id:string)=>get('SELECT * FROM candidate_integrations WHERE operation_id=?',id)??fail('CANDIDATE_INTEGRATION_NOT_FOUND',404);
 const originalStep=(id:string,ordinal:number)=>get('SELECT * FROM candidate_integration_steps WHERE operation_id=? AND ordinal=?',id,ordinal);
 const frozen=(r:Row):CandidateBasis=>JSON.parse(String(r.basis_json));
 const manifest=(r:Row):SourceManifest|null=>r.manifest_json?JSON.parse(String(r.manifest_json)):null;
 const expectedHead=(r:Row):CandidateHead|null=>r.expected_head_json?JSON.parse(String(r.expected_head_json)):null;
 const head=(runId:string):CandidateHead|null=>{const r=get('SELECT * FROM managed_candidate_heads WHERE run_id=?',runId);return r?{operationId:String(r.operation_id),commit:String(r.commit_sha)}:null;};
 function proof(commit:string):CandidateProof|null{
  const r=get("SELECT * FROM candidate_integrations WHERE state='ACKNOWLEDGED' AND json_extract(manifest_json,'$.commit')=? ORDER BY rowid LIMIT 1",commit);
  return r?{projectId:String(r.project_id),runId:String(r.run_id),commit,sourceArchiveOperationIds:all('SELECT archive_operation_id FROM candidate_integration_sources WHERE operation_id=? ORDER BY ordinal',r.operation_id!).map(source=>String(source.archive_operation_id)),state:'ACKNOWLEDGED'}:null;
 }
 const basis=createCandidateBasis(db,plans,proof);
 function owned(id:string,principalId:string){const r=required(id);plans.authorized(principalId,String(r.run_id),true);if(r.principal_id!==principalId)fail('CANDIDATE_INTEGRATION_NOT_FOUND',404);return r;}
 function bound(input:{operationId:string;principalId:string;requestHash:string}){const r=owned(input.operationId,input.principalId);if(r.request_hash!==input.requestHash)fail('CANDIDATE_REQUEST_CHANGED');return r;}
 function current(r:Row,principalId:string){basis.assertCurrent(frozen(r),principalId);}
 function updates(r:Row):CandidateIntegration['updates']{
  const m=manifest(r);if(!m)return [];
  const result:CandidateIntegration['updates']=[{ref:'refs/devmesh/integrations/'+r.operation_id,commit:m.commit,expected:null},{ref:'refs/devmesh/candidate-snapshots/'+r.operation_id,commit:m.commit,expected:null}];
  if(r.purpose==='run-candidate')result.push({ref:'refs/devmesh/candidates/'+r.run_id,commit:m.commit,expected:expectedHead(r)?.commit??null});return result;
 }
 function view(r:Row):CandidateIntegration{
  const m=manifest(r);return {operationId:String(r.operation_id),projectId:String(r.project_id),runId:String(r.run_id),principalId:String(r.principal_id),purpose:r.purpose as CandidateIntegration['purpose'],workId:r.work_id as string|null,originOperationId:r.origin_operation_id as string|null,requestHash:String(r.request_hash),basisSha256:String(r.basis_sha256),expectedHead:expectedHead(r),sourceCount:frozen(r).sources.length,acknowledgedSteps:Number(get("SELECT count(*) n FROM candidate_integration_steps WHERE operation_id=? AND state='ACKNOWLEDGED'",r.operation_id!)!.n),state:r.state as CandidateIntegration['state'],manifest:m?{commit:m.commit,tree:m.tree,sha256:m.sha256}:null,updates:updates(r),acknowledgement:r.state==='ACKNOWLEDGED'&&r.acknowledgement_json?JSON.parse(String(r.acknowledgement_json)):null,conflictAcknowledgement:r.state==='CONFLICT'&&r.acknowledgement_json?JSON.parse(String(r.acknowledgement_json)):null,errorCode:r.error_code as string|null,createdAt:String(r.created_at),acknowledgedAt:r.acknowledged_at as string|null,failureProof:r.failure_json?JSON.parse(String(r.failure_json)):null};
 }
 const stepView=(r:Row):CandidateIntegrationStep=>({operationId:String(r.operation_id),ordinal:Number(r.ordinal),ours:String(r.ours),theirs:String(r.theirs),state:r.state as CandidateIntegrationStep['state'],preparation:r.preparation_json?JSON.parse(String(r.preparation_json)):null,acknowledgement:r.state==='ACKNOWLEDGED'&&r.acknowledgement_json?JSON.parse(String(r.acknowledgement_json)):null,conflictAcknowledgement:r.state==='CONFLICT'&&r.acknowledgement_json?JSON.parse(String(r.acknowledgement_json)):null,createdAt:String(r.created_at),acknowledgedAt:r.acknowledged_at as string|null});
 function stepBound(input:{operationId:string;principalId:string;requestHash:string;ordinal:number}){const r=bound(input),s=originalStep(input.operationId,input.ordinal)??fail('CANDIDATE_STEP_NOT_FOUND',404);return {r,s,step:stepView(s)};}
 function equivalentSources(a:CandidateBasis,b:CandidateBasis){
  const scope=(v:CandidateBasis)=>({projectId:v.projectId,runId:v.runId,runEpoch:v.runEpoch,requirementRevision:v.requirementRevision,planRevision:v.planRevision,planHash:v.planHash,planDecisionId:v.planDecisionId,baseCommit:v.baseCommit,repository:v.repository,sources:v.sources,developers:v.works.filter(w=>w.role==='developer')});
  return same(scope(a),scope(b));
 }
 function retainedOrigin(r:Row){
  const origin=required(String(r.origin_operation_id));
  if(r.purpose!=='run-candidate'||origin.purpose!=='work-input'||origin.state!=='ACKNOWLEDGED'||origin.origin_operation_id!==null||!manifest(origin)||!origin.acknowledgement_json||!equivalentSources(frozen(r),frozen(origin)))fail('CANDIDATE_PROMOTION_UNPROVEN');
  return origin;
 }
 function allAcknowledged(r:Row):Row[]{
  if(r.origin_operation_id){if(get('SELECT 1 FROM candidate_integration_steps WHERE operation_id=?',r.operation_id!))fail('CANDIDATE_PROMOTION_UNPROVEN');return allAcknowledged(retainedOrigin(r));}
  const count=frozen(r).sources.length,rows=all('SELECT * FROM candidate_integration_steps WHERE operation_id=? ORDER BY ordinal',r.operation_id!);if(rows.length!==count||rows.some((s,index)=>s.ordinal!==index||s.state!=='ACKNOWLEDGED'))fail('CANDIDATE_STEPS_UNRESOLVED');return rows;
 }
 function headUnchanged(r:Row){if(r.purpose==='run-candidate'&&!same(head(String(r.run_id)),expectedHead(r)))fail('CANDIDATE_HEAD_CHANGED');}
 function qualified(input:CandidateSubject){
   const admitted=basis.freeze(input),row=get("SELECT * FROM candidate_integrations WHERE run_id=? AND basis_sha256=? AND state='ACKNOWLEDGED' ORDER BY rowid DESC LIMIT 1",input.runId,admitted.sha256);
   if(!row)fail('CANDIDATE_SNAPSHOT_UNAVAILABLE');return view(row);
  }
  const handlers={
  beginCandidateIntegration(i:CandidateIntegrationInput<'beginCandidateIntegration'>){return transaction(db,()=>{
   const requestHash=digest(canonical({principalId:i.principalId,runId:i.runId,purpose:i.purpose,workId:i.workId??null,...(i.originOperationId?{originOperationId:i.originOperationId}:{})})),old=get('SELECT * FROM candidate_integrations WHERE operation_id=?',i.operationId);
   if(old){owned(i.operationId,i.principalId);if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return {...view(old),created:false};}
   const admitted=basis.freeze(i);if(Buffer.byteLength(canonical(admitted))>192*1024||admitted.sources.length>30)fail('CANDIDATE_BASIS_TOO_LARGE');
   if(get("SELECT 1 FROM candidate_integrations WHERE project_id=? AND state IN ('BUILDING','PREPARED','CAS_SENT','CONFLICT_PENDING')",admitted.projectId))fail('CANDIDATE_RECONCILIATION_REQUIRED');
   for(const table of ['operations','repo_operations','repo_file_operations','workspace_allocations','source_archives','managed_repositories'])if(get('SELECT 1 FROM '+table+' WHERE operation_id=?',i.operationId))fail('IDEMPOTENCY_KEY_REUSED');
   if(i.originOperationId){const origin=owned(i.originOperationId,i.principalId);if(origin.purpose!=='work-input'||origin.state!=='ACKNOWLEDGED'||origin.origin_operation_id!==null||!equivalentSources(admitted,frozen(origin)))fail('CANDIDATE_PROMOTION_UNPROVEN');basis.assertCurrent(frozen(origin),i.principalId);allAcknowledged(origin);}
   const oldHead=i.purpose==='run-candidate'?head(i.runId):null;
   exec("INSERT INTO candidate_integrations(operation_id,project_id,run_id,principal_id,purpose,work_id,request_hash,basis_sha256,basis_json,expected_head_json,state,created_at,origin_operation_id) VALUES(?,?,?,?,?,?,?,?,?,?,'BUILDING',?,?)",i.operationId,admitted.projectId,i.runId,i.principalId,i.purpose,i.workId??null,requestHash,admitted.sha256,canonical(admitted),oldHead?canonical(oldHead):null,new Date().toISOString(),i.originOperationId??null);
   for(const [ordinal,source] of admitted.sources.entries())exec('INSERT INTO candidate_integration_sources VALUES(?,?,?)',i.operationId,ordinal,source.archiveOperationId);
   return {...view(required(i.operationId)),created:true};
  });},
  getCandidateIntegration(i:CandidateIntegrationInput<'getCandidateIntegration'>){return view(owned(i.operationId,i.principalId));},
  getCandidateIntegrationBasis(i:CandidateIntegrationInput<'getCandidateIntegrationBasis'>){return frozen(owned(i.operationId,i.principalId));},
  getCandidateIntegrationManifest(i:CandidateIntegrationInput<'getCandidateIntegrationManifest'>){return manifest(owned(i.operationId,i.principalId));},
  getCandidateIntegrationStep(i:CandidateIntegrationInput<'getCandidateIntegrationStep'>){owned(i.operationId,i.principalId);const s=originalStep(i.operationId,i.ordinal);return s?stepView(s):null;},
  beginCandidateStep(i:CandidateIntegrationInput<'beginCandidateStep'>){return transaction(db,()=>{
   const r=bound(i),old=originalStep(i.operationId,i.ordinal);if(r.origin_operation_id)fail('CANDIDATE_PROMOTION_HAS_ORIGINAL_STEPS');if(old)return {...stepView(old),created:false};if(r.state!=='BUILDING')fail('CANDIDATE_INTEGRATION_CLOSED');current(r,i.principalId);
   const original=frozen(r),source=original.sources[i.ordinal];if(!source)fail('CANDIDATE_STEP_ORDER_INVALID');
   const earlier=all('SELECT * FROM candidate_integration_steps WHERE operation_id=? ORDER BY ordinal',i.operationId);
   if(earlier.length!==i.ordinal||earlier.some((s,index)=>s.ordinal!==index||s.state!=='ACKNOWLEDGED'))fail('CANDIDATE_STEP_ORDER_INVALID');
   const ours=i.ordinal===0?original.baseCommit:stepView(earlier.at(-1)!).preparation!.commit!;
   exec("INSERT INTO candidate_integration_steps(operation_id,ordinal,ours,theirs,state,created_at) VALUES(?,?,?,?,'COMPUTING',?)",i.operationId,i.ordinal,ours,source.commit,new Date().toISOString());return {...stepView(originalStep(i.operationId,i.ordinal)!),created:true};
  });},
  prepareCandidateStep(i:CandidateIntegrationInput<'prepareCandidateStep'>){return transaction(db,()=>{
   const {r,s,step}=stepBound(i),bases=[...new Set(i.bases)].sort();if(bases.length!==i.bases.length)fail('CANDIDATE_MERGE_BASE_INVALID');
   const source=frozen(r).sources[i.ordinal]!,seconds=Math.floor(Date.parse(String(r.created_at))/1000),identity='DevMesh <devmesh@localhost> '+seconds+' +0000';
   const body=i.clean?`tree ${i.tree}\nparent ${step.ours}\nparent ${step.theirs}\nauthor ${identity}\ncommitter ${identity}\n\nDevMesh candidate integration\n\nDevMesh-Operation: ${i.operationId}\nDevMesh-Step: ${i.ordinal}\nDevMesh-Source: ${source.archiveOperationId}\n`:null;
   const prepared={bases,tree:i.tree,clean:i.clean,reportSha256:i.reportSha256,commit:body?createHash('sha1').update(Buffer.from('commit '+Buffer.byteLength(body)+'\0')).update(body).digest('hex'):null,commitBody:body,ref:i.clean?'refs/devmesh/integration-steps/'+i.operationId+'/'+i.ordinal:null};
   if(step.preparation){if(!same(step.preparation,prepared))fail('CANDIDATE_STEP_IMMUTABLE');return step;}
   if(r.state!=='BUILDING'||s.state!=='COMPUTING')fail('CANDIDATE_INTEGRATION_CLOSED');
   // Preserve a computation already admitted even after pause. Sending its ref
   // remains a separate current-basis transaction below.
   exec('UPDATE candidate_integration_steps SET state=?,preparation_json=? WHERE operation_id=? AND ordinal=?',i.clean?'PREPARED':'CONFLICT_PENDING',canonical(prepared),i.operationId,i.ordinal);
   if(!i.clean)exec("UPDATE candidate_integrations SET state='CONFLICT_PENDING' WHERE operation_id=?",i.operationId);return stepView(originalStep(i.operationId,i.ordinal)!);
  });},
  markCandidateStepSent(i:CandidateIntegrationInput<'markCandidateStepSent'>){return transaction(db,()=>{
   const {r,step}=stepBound(i);if(['REF_SENT','ACKNOWLEDGED'].includes(step.state))return {...step,send:false};if(r.state!=='BUILDING'||step.state!=='PREPARED'||!step.preparation?.clean)fail('CANDIDATE_STEP_UNPREPARED');
   current(r,i.principalId);exec("UPDATE candidate_integration_steps SET state='REF_SENT' WHERE operation_id=? AND ordinal=?",i.operationId,i.ordinal);return {...stepView(originalStep(i.operationId,i.ordinal)!),send:true};
  });},
  acknowledgeCandidateStep(i:CandidateIntegrationInput<'acknowledgeCandidateStep'>){return transaction(db,()=>{
   const {r,step}=stepBound(i),p=step.preparation,a=i.proof;
   if(!p?.clean||a.commit!==p.commit||a.tree!==p.tree||a.ref!==p.ref||!same(a.repositoryIdentity,frozen(r).repository.identity))fail('CANDIDATE_STEP_ACK_UNPROVEN');
   if(step.state==='ACKNOWLEDGED'){if(!same(step.acknowledgement,a))fail('CANDIDATE_STEP_IMMUTABLE');return step;}
   if(r.state!=='BUILDING'||step.state!=='REF_SENT')fail('CANDIDATE_STEP_UNPREPARED');exec("UPDATE candidate_integration_steps SET state='ACKNOWLEDGED',acknowledgement_json=?,acknowledged_at=? WHERE operation_id=? AND ordinal=?",canonical(a),new Date().toISOString(),i.operationId,i.ordinal);return stepView(originalStep(i.operationId,i.ordinal)!);
  });},
  prepareCandidateIntegration(i:CandidateIntegrationInput<'prepareCandidateIntegration'>){return transaction(db,()=>{
   const r=bound(i),old=manifest(r);if(old){if(!same(old,i.manifest))fail('CANDIDATE_MANIFEST_IMMUTABLE');return view(r);}if(r.state!=='BUILDING')fail('CANDIDATE_INTEGRATION_CLOSED');
   const steps=allAcknowledged(r),last=steps.length?stepView(steps.at(-1)!).preparation!:null,commit=last?.commit??frozen(r).baseCommit,m=i.manifest,{sha256,...facts}=m;
   if(r.origin_operation_id&&!same(manifest(retainedOrigin(r)),m))fail('CANDIDATE_PROMOTION_MANIFEST_CHANGED');
   if(m.commit!==commit||last&&m.tree!==last.tree||sha256!==digest(canonical(facts))||m.byteSize!==m.files.reduce((n,file)=>n+file.byteSize,0)||new Set(m.files.map(file=>file.path.toLowerCase())).size!==m.files.length||Buffer.byteLength(canonical(m))>192*1024)fail('CANDIDATE_MANIFEST_UNPROVEN');
   current(r,i.principalId);headUnchanged(r);exec("UPDATE candidate_integrations SET state='PREPARED',manifest_json=?,error_code=NULL WHERE operation_id=?",canonical(m),i.operationId);return view(required(i.operationId));
  });},
  markCandidateIntegrationSent(i:CandidateIntegrationInput<'markCandidateIntegrationSent'>){return transaction(db,()=>{
   const r=bound(i);if(['CAS_SENT','ACKNOWLEDGED'].includes(String(r.state)))return {...view(r),send:false};if(r.state!=='PREPARED')fail('CANDIDATE_INTEGRATION_UNPREPARED');
   current(r,i.principalId);allAcknowledged(r);headUnchanged(r);exec("UPDATE candidate_integrations SET state='CAS_SENT',error_code=NULL WHERE operation_id=?",i.operationId);return {...view(required(i.operationId)),send:true};
  });},
  acknowledgeCandidateIntegration(i:CandidateIntegrationInput<'acknowledgeCandidateIntegration'>){return transaction(db,()=>{
   const r=bound(i),m=manifest(r),a=i.acknowledgement;if(!m||m.sha256!==a.manifestSha256||!same(a.repositoryIdentity,frozen(r).repository.identity)||!same(a.refs,updates(r).map(({ref,commit})=>({ref,commit}))))fail('CANDIDATE_ACK_UNPROVEN');
   if(r.state==='ACKNOWLEDGED'){if(!same(a,JSON.parse(String(r.acknowledgement_json))))fail('CANDIDATE_ACK_IMMUTABLE');return view(r);}if(r.state!=='CAS_SENT')fail('CANDIDATE_INTEGRATION_UNPREPARED');
   allAcknowledged(r);headUnchanged(r);exec("UPDATE candidate_integrations SET state='ACKNOWLEDGED',acknowledgement_json=?,acknowledged_at=?,error_code=NULL WHERE operation_id=?",canonical(a),new Date().toISOString(),i.operationId);
   if(r.purpose==='run-candidate')exec('INSERT INTO managed_candidate_heads VALUES(?,?,?,?) ON CONFLICT(run_id) DO UPDATE SET operation_id=excluded.operation_id,commit_sha=excluded.commit_sha',r.run_id!,r.project_id!,i.operationId,m.commit);return view(required(i.operationId));
  });},
  failUnsentCandidateIntegration(i:CandidateIntegrationInput<'failUnsentCandidateIntegration'>){return transaction(db,()=>{
   const r=bound(i);if(r.state==='FAILED'){if(r.failure_json!==null||r.error_code!==i.errorCode)fail('CANDIDATE_FAILURE_IMMUTABLE');return view(r);}if(!['BUILDING','PREPARED'].includes(String(r.state))||get("SELECT 1 FROM candidate_integration_steps WHERE operation_id=? AND state NOT IN ('ACKNOWLEDGED','PREPARED')",i.operationId))fail('CANDIDATE_EFFECT_UNRESOLVED');
   exec("UPDATE candidate_integration_steps SET state='ABANDONED' WHERE operation_id=? AND state='PREPARED'",i.operationId);exec("UPDATE candidate_integrations SET state='FAILED',error_code=? WHERE operation_id=?",i.errorCode,i.operationId);return view(required(i.operationId));
  });},
  recordCandidateCasRejection(i:CandidateIntegrationInput<'recordCandidateCasRejection'>){return transaction(db,()=>{
   const r=bound(i),failure={originalRefsAbsent:i.originalRefsAbsent,gitChildExited:i.gitChildExited,observedHead:i.observedHead};if(r.state==='FAILED'){if(!r.failure_json||!same(JSON.parse(String(r.failure_json)),failure))fail('CANDIDATE_FAILURE_IMMUTABLE');return view(r);}if(r.state!=='CAS_SENT'||r.purpose==='run-candidate'&&i.observedHead===manifest(r)?.commit||r.purpose==='work-input'&&i.observedHead!==null)fail('CANDIDATE_EFFECT_UNRESOLVED');
   // Only the adapter which observed Git close and absent original unique refs
   // may record this fact. Missing refs during recovery alone do not prove it.
   exec("UPDATE candidate_integrations SET state='FAILED',failure_json=?,error_code='CANDIDATE_REF_CAS_REJECTED' WHERE operation_id=?",canonical(failure),i.operationId);return view(required(i.operationId));
  });},
  markCandidateIntegrationUncertain(i:CandidateIntegrationInput<'markCandidateIntegrationUncertain'>){return transaction(db,()=>{const r=bound(i);if(!closed(String(r.state)))exec('UPDATE candidate_integrations SET error_code=? WHERE operation_id=?',i.errorCode,i.operationId);return view(required(i.operationId));});},
  getQualifiedCandidateSnapshot(i:CandidateIntegrationInput<'getQualifiedCandidateSnapshot'>){return transaction(db,()=>{
   return qualified(i);
  });},
 };
 return {basis,qualified,execute(method:CandidateIntegrationMethod,input:unknown){return (handlers[method] as (input:unknown)=>unknown)(parseContract(candidateIntegrationRequests[method],input));}};
}
