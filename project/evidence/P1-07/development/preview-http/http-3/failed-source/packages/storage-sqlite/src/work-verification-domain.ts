import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {roleOutput,workRevision,parseContract} from '@devmesh/contracts';
import type {RoleOutput} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {createRuntimeWorkspaces} from './runtime-workspaces.js';
import {knownAttemptEffects} from './work-effects.js';
import {workVerificationRequests} from './work-verification-protocol.js';
import type {WorkVerificationMethod,WorkVerificationInput,WorkVerification,WorkAssessment,WorkArtifactRef} from './work-verification-protocol.js';
import type {createQualityDomain} from './quality-domain.js';
import type {Parsed} from './protocol.js';
type Row=Record<string,string|number|null>;
type Target={operationId:string};
const json=<T>(v:unknown):T=>JSON.parse(String(v)) as T;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Formal Work completion requires current original verification facts');}
export function createWorkVerificationDomain(db:DatabaseSync,quality?:Pick<ReturnType<typeof createQualityDomain>,'completionFacts'>){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[],exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p),workspaceResults=createRuntimeWorkspaces(db);
 function authorized(principalId:string,runId:string,write=false){const r=get('SELECT r.*,p.owner_id,m.role FROM runs r JOIN projects p ON p.project_id=r.project_id JOIN project_members m ON m.project_id=p.project_id AND m.principal_id=? WHERE r.run_id=?',principalId,runId);if(!r||write&&(r.owner_id!==principalId||r.role!=='owner'))fail('WORK_VERIFICATION_NOT_FOUND',404);return r;}
 const record=(id:string)=>get('SELECT * FROM work_verifications WHERE operation_id=?',id)??fail('WORK_VERIFICATION_NOT_FOUND',404);
 function owned(principalId:string,id:string,write=false){const row=record(id);authorized(principalId,String(row.run_id),write);if(write&&row.principal_id!==principalId)fail('WORK_VERIFICATION_NOT_FOUND',404);return row;}
 function candidate(principalId:string,runId:string,attemptId:string,terminal=false){
  const r=authorized(principalId,runId,true),a=get('SELECT * FROM attempts WHERE attempt_id=? AND run_id=?',attemptId,runId)??fail('WORK_VERIFICATION_ATTEMPT_MISSING');
  if(r.control_gate!=='OPEN'||r.terminal_outcome!==null||a.ended_at!==null&&!terminal||!(terminal?['VERIFYING','SUCCEEDED','FAILED']:['VERIFYING']).includes(String(a.state)))fail('WORK_VERIFICATION_ADMISSION_CLOSED');
  const scheduled=get('SELECT * FROM scheduled_work WHERE attempt_id=?',attemptId),w=get('SELECT * FROM works WHERE run_id=? AND work_id=?',runId,a.work_id!),planned=get('SELECT * FROM plan_works WHERE run_id=? AND plan_revision=? AND work_id=?',runId,r.current_plan_revision!,a.work_id!);
  if(!scheduled||!w||!planned||w.blocked_reason!==null||r.run_epoch!==a.admitted_run_epoch||w.work_epoch!==a.admitted_work_epoch||planned.work_revision!==a.work_revision||scheduled.plan_revision!==r.current_plan_revision||!get('SELECT 1 FROM plan_confirmations WHERE run_id=? AND plan_revision=? AND requirement_revision=?',runId,r.current_plan_revision!,r.current_requirement_revision!))fail('WORK_VERIFICATION_BASIS_STALE');
   const result=get(`SELECT rr.*,ra.config_json,ra.state runtime_state,ra.grant_id,a.content_hash,a.input_fingerprint candidate_fingerprint,a.state artifact_state,c.state content_state
   FROM runtime_results rr JOIN runtime_activations ra ON ra.activation_id=rr.activation_id JOIN artifacts a ON a.artifact_id=rr.artifact_id
   JOIN content_objects c ON c.content_hash=a.content_hash WHERE ra.attempt_id=? AND a.attempt_id=? AND a.run_id=?`,attemptId,attemptId,runId);
   if(!result||result.runtime_state!=='FINISHED'||result.artifact_state!=='READY'||result.content_state!=='READY'||result.candidate_fingerprint!==a.input_fingerprint)fail('WORK_VERIFICATION_CANDIDATE_MISSING');
  const work=workRevision.parse(json(get('SELECT definition_json FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?',runId,a.work_id!,a.work_revision!)!.definition_json));
  return {r,a,result,work,ref:{artifactId:String(result.artifact_id),sha256:String(result.content_hash)}};
 }
 function assess(principalId:string,runId:string,attemptId:string,raw:RoleOutput,qualityOperationId:string|null,terminal=false){
  const c=candidate(principalId,runId,attemptId,terminal),output=roleOutput.parse(raw),{r,a,result,work}=c,role=json<{role:string;outputSchemaId:string}>(a.role_snapshot_json),manifest=json<{codeCommit:string|null;checkConfigHash:string}>(a.input_manifest_json);
  if(digest(canonical(output))!==c.ref.sha256||output.role!==a.role||output.role!==role.role||output.schemaVersion!==role.outputSchemaId)fail('WORK_VERIFICATION_CANDIDATE_CHANGED');
  if(!knownAttemptEffects(db,attemptId))fail('WORK_VERIFICATION_EFFECT_UNKNOWN');
  const checks:WorkAssessment['checks']=[],add=(kind:string,status:WorkAssessment['automaticStatus'],code:string)=>checks.push({kind,status,code});
  const readyRef=(ref:WorkArtifactRef)=>!!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.run_id=? AND a.project_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'",ref.artifactId,runId,r.project_id!,ref.sha256);
  let archive:Row|undefined,qualified:ReturnType<NonNullable<typeof quality>['completionFacts']>|undefined,codeCommit:string|null=null;
  const workspace=workspaceResults.get(String(result.activation_id));
  if(output.role==='developer'||output.role==='tester'){
   if(!workspace||workspace.contentHash!==c.ref.sha256||canonical(workspace.output)!==canonical(output))fail('WORK_VERIFICATION_WORKSPACE_UNPROVEN');
   workspaceResults.assertPublication({...result,activation_id:result.activation_id!,attempt_id:attemptId},Number(result.step_no),c.ref.sha256,output);
  }
  if(output.role==='developer'){
   archive=get("SELECT * FROM source_archives WHERE operation_id=? AND attempt_id=? AND state='ACKNOWLEDGED'",workspace!.archiveOperationId!,attemptId);
   if(!archive?.manifest_json||!archive.acknowledgement_json||json<{commit:string}>(archive.manifest_json).commit!==output.resultCommit||output.baseCommit!==manifest.codeCommit)fail('WORK_VERIFICATION_SOURCE_UNPROVEN');codeCommit=output.resultCommit;
   if(output.unverified.length)add('developer-result','MISSING','DECLARED_CHECKS_UNVERIFIED');
   for(const ref of [...output.checkRefs,...(output.handoffProposal?.artifactRefs??[])])if(!readyRef(ref))add('candidate-evidence','MISSING','CANDIDATE_EVIDENCE_UNAVAILABLE');
  }else if(output.role==='tester'){
   if(!quality||!qualityOperationId)fail('WORK_VERIFICATION_QUALITY_REQUIRED');qualified=quality.completionFacts(qualityOperationId,principalId,attemptId);
   if(qualified.verification.configHash!==manifest.checkConfigHash||qualified.verification.basis.targetCommit!==output.targetCommit||output.targetCommit!==manifest.codeCommit||qualified.verification.allocationOperationId!==workspace!.allocationOperationId)fail('WORK_VERIFICATION_QUALITY_CHANGED');
    const evaluation=qualified.verification.evaluation!,materials=qualified.materials.filter(m=>m.contentHash),hashes=(kind:'coverage'|'tests')=>new Set(materials.filter(m=>{const d=m.descriptor;return d.kind==='REPORT'&&qualified!.policy.reports.some(r=>r.reportId===d.report.reportId&&r.format===(kind==='tests'?'vitest-json-v1':'istanbul-v1'));}).map(m=>m.contentHash!));
   const resultHash=materials.find(m=>m.materialKey==='result')!.contentHash!,coverage=hashes('coverage'),tests=hashes('tests');coverage.add(resultHash);tests.add(resultHash);
   const verifyRef=(ref:WorkArtifactRef,allowed:Set<string>)=>readyRef(ref)&&allowed.has(ref.sha256);
   if(!verifyRef(output.coverageRef,coverage)||!verifyRef(output.buildRef,new Set([resultHash])))add('candidate-evidence','FAIL','CANDIDATE_REPORT_PROVENANCE_CHANGED');
    if(output.caseResults.length!==qualified.policy.checks.filter(c=>c.kind==='tests').length||new Set(output.caseResults.map(c=>c.checkId)).size!==output.caseResults.length)add('candidate-tests','FAIL','CANDIDATE_TEST_SCOPE_CHANGED');
   for(const expected of qualified.policy.checks.filter(c=>c.kind==='tests')){const actual=output.caseResults.filter(c=>c.checkId===expected.checkId),measured=evaluation.checks.find(c=>c.checkId===expected.checkId)!;
    if(actual.length!==1||!verifyRef(actual[0]!.reportRef,tests)||canonical([...new Set(expected.requiredTests.flatMap(t=>t.requirementIds))].sort())!==canonical([...new Set(actual[0]!.requirementIds)].sort()))add('candidate-tests','FAIL','CANDIDATE_REPORT_PROVENANCE_CHANGED');
    else if((actual[0]!.status==='PASSED')!==(measured.status==='PASS'))add('candidate-tests','FAIL','CANDIDATE_STATUS_CONTRADICTS_RAW_REPORT');
   }
   for(const defect of output.defects)for(const ref of defect.evidenceRefs)if(!readyRef(ref)||!materials.some(m=>m.contentHash===ref.sha256))add('candidate-defect','FAIL','CANDIDATE_REPORT_PROVENANCE_CHANGED');
    if(output.defects.length)add('candidate-defect','FAIL','CANDIDATE_FINDING_UNRESOLVED');
    if(output.previewRef&&!readyRef(output.previewRef))add('candidate-preview','MISSING','CANDIDATE_EVIDENCE_UNAVAILABLE');
   add('independent-quality',evaluation.automaticStatus==='STALE'?'MISSING':evaluation.automaticStatus,'ORIGINAL_QUALITY_'+evaluation.automaticStatus);
    if(evaluation.reviewStatus==='PENDING')add('quality-review','PENDING','HUMAN_DECISION_REQUIRED');
  }else if(output.role==='architect')for(const entry of output.interfaces)if(!readyRef(entry.specificationRef))add('candidate-interface','MISSING','CANDIDATE_EVIDENCE_UNAVAILABLE');
  const outputs=work.outputSpec.map(s=>({slot:s.slot,ref:c.ref}));for(const slot of work.outputSpec)if(slot.schemaId!==output.schemaVersion)add('output-schema','MISSING','OUTPUT_SCHEMA_VERIFIER_UNAVAILABLE');
  for(const check of work.completionChecks){
   if(check.kind==='artifact-exists')add(check.kind,'PASS','CANDIDATE_ARTIFACT_READY');
   else if(check.kind==='schema-valid')add(check.kind,check.schemaId===output.schemaVersion?'PASS':'MISSING',check.schemaId===output.schemaVersion?'CANDIDATE_SCHEMA_VALID':'OUTPUT_SCHEMA_VERIFIER_UNAVAILABLE');
   else if(check.kind==='commit-resolved')add(check.kind,output.role==='developer'&&archive?'PASS':'MISSING',archive?'SOURCE_ARCHIVE_ACKNOWLEDGED':'SOURCE_COMMIT_UNPROVEN');
   else if(check.kind==='human-decision')add(check.kind,'PENDING','HUMAN_DECISION_REQUIRED');
   else if(check.kind==='coverage-threshold'){const metric=qualified?.verification.evaluation?.checks.find(c=>c.coverage)?.coverage;add(check.kind,metric&&qualified!.policy.thresholds.lines>=check.lines&&qualified!.policy.thresholds.branches>=check.branches&&metric.lines.status==='PASS'&&['PASS','NOT_APPLICABLE'].includes(metric.branches.status)?'PASS':qualified?'FAIL':'MISSING',qualified?'ORIGINAL_COVERAGE_CHECK':'FIXED_SOURCE_CHECK_UNPROVEN');}
   else{const measured=qualified?.verification.evaluation?.checks.find(c=>c.checkId===check.checkId),definition=qualified?.policy.checks.find(c=>c.checkId===check.checkId),kind=check.kind==='required-tests-pass'?'tests':'command';add(check.kind,measured&&definition?.kind===kind?measured.status==='STALE'||measured.status==='NOT_APPLICABLE'?'MISSING':measured.status:'MISSING',measured?'ORIGINAL_REQUIRED_CHECK':'FIXED_SOURCE_CHECK_UNPROVEN');}
  }
  const basis={runId,attemptId,workId:a.work_id,workRevision:a.work_revision,workEpoch:a.admitted_work_epoch,runEpoch:a.admitted_run_epoch,planRevision:r.current_plan_revision,requirementRevision:r.current_requirement_revision,inputFingerprint:a.input_fingerprint,inputManifestSha256:digest(String(a.input_manifest_json)),roleSnapshotSha256:digest(String(a.role_snapshot_json)),candidate:c.ref,candidateSha256:digest(canonical(output)),workspace:workspace??null,sourceArchive:archive?{operationId:archive.operation_id,manifestSha256:digest(String(archive.manifest_json)),ackSha256:digest(String(archive.acknowledgement_json))}:null,quality:qualified?{operationId:qualityOperationId,basis:qualified.verification.basis,evaluation:qualified.verification.evaluation,materials:qualified.materials.map(m=>({key:m.materialKey,hash:m.contentHash,descriptor:m.descriptor}))}:null};
  const status:WorkAssessment['automaticStatus']=checks.some(c=>c.status==='PENDING')?'PENDING':checks.some(c=>c.status==='FAIL')?'FAIL':checks.some(c=>c.status==='MISSING')?'MISSING':'PASS',outcome:WorkAssessment['outcome']=status==='PASS'?'success':output.role==='tester'&&qualified&&status!=='PENDING'?'completed-with-findings':null;
  const evaluation:WorkAssessment={schemaVersion:'devmesh.work-verification.v1',runId,attemptId,workId:String(a.work_id),workRevision:Number(a.work_revision),inputFingerprint:String(a.input_fingerprint),basisSha256:digest(canonical(basis)),candidate:c.ref,outputs,codeCommit,qualityOperationId,checks,automaticStatus:status,outcome};return {basis,evaluation,c};
 }
 function current(row:Row){try{return digest(canonical(assess(String(row.principal_id),String(row.run_id),String(row.attempt_id),json(row.candidate_json),row.quality_operation_id as string|null,row.state==='APPLIED').basis))===digest(String(row.basis_json));}catch(error){if(error instanceof StorageError)return false;throw error;}}
 const view=(row:Row):WorkVerification=>({operationId:String(row.operation_id),principalId:String(row.principal_id),runId:String(row.run_id),attemptId:String(row.attempt_id),requestHash:String(row.request_hash),state:row.state as WorkVerification['state'],qualification:current(row)?'CURRENT':'STALE',evaluation:json(row.evaluation_json),expectedHash:String(row.expected_hash),byteSize:Number(row.byte_size),writeKey:String(row.write_key),completionKey:String(row.completion_key),artifactId:row.artifact_id as string|null,contentHash:row.content_hash as string|null,writeId:row.write_id as string|null});
 const handlers={
  getWorkVerificationCandidate(i:WorkVerificationInput<'getWorkVerificationCandidate'>){const c=candidate(i.principalId,i.runId,i.attemptId);return {candidate:c.ref,work:c.work};},
  beginWorkVerification(i:WorkVerificationInput<'beginWorkVerification'>){return transaction(db,()=>{const hash=digest(canonical(i)),old=get('SELECT * FROM work_verifications WHERE operation_id=?',i.operationId);if(old){owned(i.principalId,i.operationId,true);if(old.request_hash!==hash)fail('WORK_VERIFICATION_REQUEST_CHANGED');return view(old);}const result=assess(i.principalId,i.runId,i.attemptId,i.candidate,i.qualityOperationId),body=canonical(result.evaluation),time=new Date().toISOString();if(Buffer.byteLength(body)>256*1024)fail('WORK_VERIFICATION_TOO_LARGE');exec("INSERT INTO work_verifications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'PREPARED',NULL,NULL,NULL,?,NULL)",i.operationId,i.principalId,i.runId,i.attemptId,hash,canonical(i.candidate),i.qualityOperationId,canonical(result.basis),body,digest(body),Buffer.byteLength(body),randomUUID(),randomUUID(),'artifact_'+randomUUID().replaceAll('-',''),time);return view(record(i.operationId));});},
  getWorkVerification(i:WorkVerificationInput<'getWorkVerification'>){return view(owned(i.principalId,i.operationId));},
  listWorkVerifications(i:WorkVerificationInput<'listWorkVerifications'>){authorized(i.principalId,i.runId);return all('SELECT * FROM work_verifications WHERE run_id=? AND operation_id>? ORDER BY operation_id LIMIT ?',i.runId,i.afterOperationId,i.limit).map(view);},
 };
 return {
   frozenFacts(principalId:string,operationId:string,allowCarried=false){
    const r=owned(principalId,operationId,true);if(allowCarried?r.state!=='APPLIED':!['READY','APPLIED'].includes(String(r.state))||!current(r))fail('WORK_VERIFICATION_BASIS_STALE');
    const assessment=json<WorkAssessment>(r.evaluation_json);
    if(!r.content_hash||r.content_hash!==digest(canonical(assessment))||!get("SELECT 1 FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.artifact_id=? AND a.content_hash=? AND a.state='READY' AND c.state='READY'",r.artifact_id!,r.content_hash))fail('WORK_VERIFICATION_CONTENT_UNAVAILABLE');
    return {state:String(r.state),assessment,operationId:String(r.operation_id),runId:String(r.run_id),attemptId:String(r.attempt_id),evidence:{artifactId:String(r.artifact_id),sha256:String(r.content_hash)}};
   },
  authorize(principalId:string,target:Target){return owned(principalId,target.operationId,true);},
  validateWrite(i:{meta:{principalId:string;scopeId:string;idempotencyKey:string};target:Target;expectedHash:string;expectedSize:number}){const row=this.authorize(i.meta.principalId,i.target);if(i.meta.scopeId!==row.operation_id||i.meta.idempotencyKey!==row.write_key||i.expectedHash!==row.expected_hash||i.expectedSize!==row.byte_size)fail('WORK_VERIFICATION_WRITE_CHANGED');},
  commit(principalId:string,target:Target,hash:string,writeId:string){const row=this.authorize(principalId,target);if(hash!==row.expected_hash||row.write_id&&row.write_id!==writeId)fail('WORK_VERIFICATION_WRITE_CHANGED');if(row.content_hash)return {artifactId:String(row.artifact_id),contentHash:hash};const a=get('SELECT * FROM attempts WHERE attempt_id=?',row.attempt_id!)!,r=authorized(principalId,String(row.run_id),true);exec("INSERT INTO artifacts VALUES(?,?,?,?,?,?,?,?,'READY',?,NULL,?)",row.expected_artifact_id!,r.project_id!,row.run_id!,row.attempt_id!,'work-verification',hash,row.byte_size!,'sha256/'+hash.slice(0,2)+'/'+hash,a.input_fingerprint!,new Date().toISOString());exec("UPDATE work_verifications SET state='READY',content_hash=?,artifact_id=expected_artifact_id,write_id=? WHERE operation_id=?",hash,writeId,target.operationId);return {artifactId:String(row.expected_artifact_id),contentHash:hash};},
  resolve(principalId:string,target:Target){const row=owned(principalId,target.operationId);if(!row.content_hash||!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY'",row.content_hash))fail('WORK_VERIFICATION_CONTENT_UNAVAILABLE');return {content_hash:String(row.content_hash)};},
   assertCompletion(i:Parsed<'recordVerifiedWork'>){if(!i.verificationOperationId)fail('WORK_VERIFICATION_REQUIRED');const row=owned(i.meta.principalId,i.verificationOperationId,true);if(row.run_id!==i.runId||row.attempt_id!==i.attemptId||row.state!=='READY'||!current(row))fail('WORK_VERIFICATION_BASIS_STALE');const result=json<WorkAssessment>(row.evaluation_json);if(i.meta.idempotencyKey!==row.completion_key||!result.outcome||result.outcome!==i.outcome||canonical(result.outputs)!==canonical(i.outputs)||result.codeCommit!==i.codeCommit||row.artifact_id!==i.evidence.artifactId||row.content_hash!==i.evidence.sha256||!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY'",row.content_hash!))fail('WORK_VERIFICATION_RESULT_CHANGED');return row;},
  applied(id:string){exec("UPDATE work_verifications SET state='APPLIED',applied_at=? WHERE operation_id=?",new Date().toISOString(),id);},
  execute(method:WorkVerificationMethod,input:unknown):unknown{const parsed=parseContract(workVerificationRequests[method],input);return (handlers[method] as (i:unknown)=>unknown)(parsed);},
 };
}
