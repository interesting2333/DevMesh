import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {createToolAuthorityDomain} from './tool-authority-domain.js';
import {repoFileRequests,repoWriteFileArgs,repoDeleteFileArgs} from './repo-file-protocol.js';
import type {RepoFileInput,RepoFileMethod,RepoFileOperation} from './repo-file-protocol.js';
type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Repository file action could not be applied');}
export function assertRepoFilesSettled(db:DatabaseSync,workspaceRef:string){if(db.prepare('SELECT 1 FROM repo_file_operations WHERE workspace_ref=? AND cleanup_confirmed=0 LIMIT 1').get(workspaceRef))fail('REPO_FILE_RECONCILIATION_REQUIRED');}
export function createRepoFileDomain(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,authority=createToolAuthorityDomain(db);
 const exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const required=(id:string)=>get('SELECT * FROM repo_file_operations WHERE operation_id=?',id)??fail('REPO_FILE_OPERATION_NOT_FOUND',404);
 const view=(r:Row):RepoFileOperation=>({operationId:String(r.operation_id),toolName:r.tool_name as RepoFileOperation['toolName'],requestHash:String(r.request_hash),state:String(r.state),cleanupConfirmed:r.cleanup_confirmed===1,scope:JSON.parse(String(r.scope_json)) as string[],request:JSON.parse(String(r.request_json)) as RepoFileOperation['request'],proof:r.prepared_json?JSON.parse(String(r.prepared_json)) as RepoFileOperation['proof']:null,result:r.result_json?JSON.parse(String(r.result_json)) as Record<string,unknown>:null});
 function owned(r:Row,p:ExecutionPermit){authority.check(p,'repo.fileByOperation','read');if(p.ownerKind!=='workflowAttempt'||r.run_id!==p.runId||r.attempt_id!==p.attemptId||r.activation_id!==p.activationId||r.grant_id!==p.grantId)fail('REPO_FILE_OPERATION_NOT_FOUND',404);return r;}
 const handlers={
  beginRepoFileOperation(i:RepoFileInput<'beginRepoFileOperation'>){return transaction(db,()=>{
   const args=i.toolName==='repo.writeFile'?parseContract(repoWriteFileArgs,i.args):parseContract(repoDeleteFileArgs,i.args),request={args,binding:i.binding},requestHash=digest(canonical({toolName:i.toolName,...request})),old=get('SELECT * FROM repo_file_operations WHERE operation_id=?',i.operationId);
   if(get('SELECT 1 FROM repo_operations WHERE operation_id=?',i.operationId))fail('IDEMPOTENCY_KEY_REUSED');
   if(old){owned(old,i.permit);if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return {...view(old),created:false};}
   const h=authority.check(i.permit,i.toolName,'write'),p=i.permit,b=i.binding;
   if(p.ownerKind!=='workflowAttempt'||b.projectId!==h.projectId||b.runId!==p.runId||b.attemptId!==p.attemptId||args.workspaceRef!==b.workspaceRef||args.baseCommit!==b.baseCommit)fail('REPO_BINDING_DENIED',403);
   if((JSON.parse(String(h.host.input_manifest_json)) as {codeCommit:string}).codeCommit!==b.baseCommit)fail('REPO_BASE_CHANGED');
   if(!p.resources.some(r=>r.kind==='workspace'&&r.resourceId===b.resourceId&&r.access==='write'))fail('REPO_RESOURCE_DENIED',403);
   const w=get('SELECT definition_json FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?',p.runId,p.workId,Number(h.host.work_revision)),scope=(JSON.parse(String(w?.definition_json)) as {writeScope:string[]}).writeScope;
   if(!scope.some(s=>args.path===s||args.path.startsWith(s+'/')))fail('REPO_FILE_SCOPE_DENIED',403);
   assertRepoFilesSettled(db,b.workspaceRef);
   if(get("SELECT 1 FROM repo_operations WHERE attempt_id=? AND state IN ('SENT','PREPARED') LIMIT 1",p.attemptId))fail('REPO_GIT_RECONCILIATION_REQUIRED');
   const time=new Date().toISOString();exec("INSERT INTO repo_file_operations VALUES(?,?,?,?,?,?,?,?,?,?,'SENT',NULL,NULL,0,?,?)",i.operationId,p.runId,p.attemptId,p.activationId,p.grantId,b.workspaceRef,i.toolName,requestHash,canonical(request),canonical(scope),time,time);
   return {...view(required(i.operationId)),created:true};
  });},
  getRepoFileOperation(i:RepoFileInput<'getRepoFileOperation'>){return transaction(db,()=>view(owned(required(i.operationId),i.permit)));},
  prepareRepoFileOperation(i:RepoFileInput<'prepareRepoFileOperation'>){return transaction(db,()=>{const r=owned(required(i.operationId),i.permit);authority.check(i.permit,String(r.tool_name),'write');if(r.request_hash!==i.requestHash)fail('REPO_FILE_BASIS_CHANGED');const request=view(r).request.args;if(r.tool_name==='repo.writeFile'){const text=(request as {text:string}).text;if(i.proof.sha256!==digest(text)||i.proof.byteSize!==Buffer.byteLength(text))fail('REPO_FILE_PROOF_MISMATCH');}else if(i.proof.sha256!==request.expectedSha256)fail('REPO_FILE_PROOF_MISMATCH');if(r.prepared_json){if(r.prepared_json!==canonical(i.proof))fail('REPO_FILE_BASIS_CHANGED');return view(r);}if(r.state!=='SENT')fail('REPO_FILE_OPERATION_CLOSED');exec("UPDATE repo_file_operations SET state='PREPARED',prepared_json=?,updated_at=? WHERE operation_id=?",canonical(i.proof),new Date().toISOString(),i.operationId);return view(required(i.operationId));});},
  finishRepoFileOperation(i:RepoFileInput<'finishRepoFileOperation'>){return transaction(db,()=>{const r=required(i.operationId);if(r.request_hash!==i.requestHash)fail('REPO_FILE_BASIS_CHANGED');if(r.result_json){if(r.state!==i.state||r.result_json!==canonical(i.result))fail('REPO_FILE_RESULT_IMMUTABLE');return view(r);}if(i.state==='SUCCEEDED'&&!r.prepared_json)fail('REPO_FILE_EFFECT_UNPROVEN');exec('UPDATE repo_file_operations SET state=?,result_json=?,cleanup_confirmed=?,updated_at=? WHERE operation_id=?',i.state,canonical(i.result),i.state==='FAILED'?1:0,new Date().toISOString(),i.operationId);return view(required(i.operationId));});},
  confirmRepoFileCleanup(i:RepoFileInput<'confirmRepoFileCleanup'>){return transaction(db,()=>{const r=required(i.operationId);if(r.request_hash!==i.requestHash||r.state!=='SUCCEEDED')fail('REPO_FILE_CLEANUP_DENIED');exec('UPDATE repo_file_operations SET cleanup_confirmed=1 WHERE operation_id=?',i.operationId);return view(required(i.operationId));});},
  assertRepoWorkspaceSettled(i:RepoFileInput<'assertRepoWorkspaceSettled'>){return transaction(db,()=>{authority.check(i.permit,'repo.by-operation','read');assertRepoFilesSettled(db,i.workspaceRef);return {settled:true as const};});},
 };
 return {
  getOriginal(permit:ExecutionPermit,operationId:string){return view(owned(required(operationId),permit));},
  execute(method:RepoFileMethod,input:unknown){return (handlers[method] as (i:unknown)=>unknown)(parseContract(repoFileRequests[method],input));},
 };
}
