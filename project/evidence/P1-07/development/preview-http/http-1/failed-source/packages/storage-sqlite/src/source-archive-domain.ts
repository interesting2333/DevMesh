import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import type {ExecutionPermit} from '@devmesh/contracts';
import {parseContract} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {createToolAuthorityDomain} from './tool-authority-domain.js';
import {createWorkspaceDomain} from './workspace-domain.js';
import {assertRepoFilesSettled} from './repo-file-domain.js';
import {sourceArchiveRequests} from './source-archive-protocol.js';
import type {SourceArchive,SourceArchiveInput,SourceArchiveMethod} from './source-archive-protocol.js';
import type {ManagedRepository,WorkspaceAllocation} from './workspace-protocol.js';
import type {RepoOperation} from './repo-protocol.js';
type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Source archive could not be verified');}
export function createSourceArchiveDomain(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const authority=createToolAuthorityDomain(db),workspaces=createWorkspaceDomain(db);
 const required=(id:string)=>get('SELECT * FROM source_archives WHERE operation_id=?',id)??fail('SOURCE_ARCHIVE_NOT_FOUND',404);
 const view=(r:Row):SourceArchive=>({operationId:String(r.operation_id),allocationOperationId:String(r.allocation_operation_id),commitOperationId:String(r.commit_operation_id),workspaceRef:String(r.workspace_ref),requestHash:String(r.request_hash),state:r.state as SourceArchive['state'],basis:JSON.parse(String(r.basis_json)),manifest:r.manifest_json?JSON.parse(String(r.manifest_json)):null,acknowledgement:r.acknowledgement_json?JSON.parse(String(r.acknowledgement_json)):null,errorCode:r.error_code as string|null,acknowledgedAt:r.acknowledged_at as string|null});
 function owned(r:Row,p:ExecutionPermit){authority.check(p,'repo.by-operation','read');if(p.ownerKind!=='workflowAttempt'||p.runId!==r.run_id||p.attemptId!==r.attempt_id||p.activationId!==r.activation_id||p.grantId!==r.grant_id||!p.resources.some(v=>v.kind==='workspace'&&v.resourceId===r.workspace_ref&&v.access==='write'))fail('SOURCE_ARCHIVE_NOT_FOUND',404);return r;}
 function basis(input:SourceArchiveInput<'beginSourceArchive'>){
  const p=input.permit,h=authority.check(p,'repo.by-operation','read');if(p.ownerKind!=='workflowAttempt'||h.host.role!=='developer')fail('SOURCE_ARCHIVE_OWNER_DENIED',403);
  const allocation=workspaces.execute('getWorkspaceAllocation',{permit:p,operationId:input.allocationOperationId}) as WorkspaceAllocation,repository=workspaces.execute('getAllocationRepository',{permit:p,operationId:input.allocationOperationId}) as ManagedRepository;
  if(allocation.state!=='READY'||allocation.kind!=='development'||!allocation.identity||repository.state!=='READY'||!repository.identity)fail('SOURCE_ARCHIVE_SOURCE_NOT_READY');
  const r=get('SELECT * FROM repo_operations WHERE operation_id=?',input.commitOperationId)??fail('SOURCE_ARCHIVE_COMMIT_NOT_FOUND',404);
  if(r.run_id!==p.runId||r.attempt_id!==p.attemptId||r.activation_id!==p.activationId||r.grant_id!==p.grantId||r.tool_name!=='repo.commit'||r.state!=='SUCCEEDED'||!r.prepared_json)fail('SOURCE_ARCHIVE_COMMIT_UNPROVEN');
  const commitOperation:RepoOperation={operationId:String(r.operation_id),toolName:'repo.commit',requestHash:String(r.request_hash),state:String(r.state),createdAt:String(r.created_at),scope:JSON.parse(String(r.scope_json)),request:JSON.parse(String(r.request_json)),prepared:JSON.parse(String(r.prepared_json)),result:r.result_json?JSON.parse(String(r.result_json)):null},b=commitOperation.request.binding,prepared=commitOperation.prepared!;
  if(b.projectId!==allocation.projectId||b.runId!==allocation.runId||b.attemptId!==allocation.attemptId||b.workspaceRef!==allocation.workspaceRef||b.resourceId!==allocation.workspaceRef||b.projectResourceId!==repository.resourceId||b.baseCommit!==allocation.baseCommit||commitOperation.request.args.baseCommit!==allocation.baseCommit||canonical(commitOperation.scope)!==canonical(allocation.scope)||prepared.ref!=='refs/devmesh/operations/'+input.commitOperationId||prepared.expected!==null||!prepared.commitBody||commitOperation.result?.commit!==prepared.commit)fail('SOURCE_ARCHIVE_BINDING_CHANGED');
  if(!p.resources.some(v=>v.kind==='workspace'&&v.resourceId===allocation.workspaceRef&&v.access==='write')||!p.resources.some(v=>v.kind==='projectRepository'&&v.resourceId===repository.resourceId))fail('SOURCE_ARCHIVE_RESOURCE_DENIED',403);
  assertRepoFilesSettled(db,allocation.workspaceRef);return {allocation,repository,commitOperation};
 }
 const handlers={
  beginSourceArchive(i:SourceArchiveInput<'beginSourceArchive'>){return transaction(db,()=>{
   const p=i.permit,hash=digest(canonical({allocationOperationId:i.allocationOperationId,commitOperationId:i.commitOperationId,owner:{runId:p.ownerKind==='workflowAttempt'?p.runId:null,attemptId:p.ownerKind==='workflowAttempt'?p.attemptId:null,activationId:p.activationId,grantId:p.grantId}})),old=get('SELECT * FROM source_archives WHERE operation_id=?',i.operationId);
   if(old){owned(old,p);if(old.request_hash!==hash)fail('IDEMPOTENCY_KEY_REUSED');return {...view(old),created:false};}
   if(get('SELECT 1 FROM repo_operations WHERE operation_id=?',i.operationId)||get('SELECT 1 FROM repo_file_operations WHERE operation_id=?',i.operationId)||get('SELECT 1 FROM workspace_allocations WHERE operation_id=?',i.operationId))fail('IDEMPOTENCY_KEY_REUSED');
   const frozen=basis(i),a=frozen.allocation;if(get("SELECT 1 FROM source_archives WHERE workspace_ref=? AND state IN ('SENT','PREPARED')",a.workspaceRef))fail('SOURCE_ARCHIVE_RECONCILIATION_REQUIRED');
   exec("INSERT INTO source_archives(operation_id,allocation_operation_id,commit_operation_id,workspace_ref,project_id,run_id,attempt_id,activation_id,grant_id,request_hash,basis_json,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'SENT',?)",i.operationId,i.allocationOperationId,i.commitOperationId,a.workspaceRef,a.projectId,a.runId,a.attemptId,a.activationId,a.grantId,hash,canonical(frozen),new Date().toISOString());return {...view(required(i.operationId)),created:true};
  });},
  getSourceArchive(i:SourceArchiveInput<'getSourceArchive'>){return view(owned(required(i.operationId),i.permit));},
  prepareSourceArchive(i:SourceArchiveInput<'prepareSourceArchive'>){return transaction(db,()=>{
   const r=owned(required(i.operationId),i.permit),original=view(r);if(r.request_hash!==i.requestHash)fail('SOURCE_ARCHIVE_BASIS_CHANGED');
   const {sha256,...facts}=i.manifest,prepared=original.basis.commitOperation.prepared!;
   if(i.manifest.commit!==prepared.commit||i.manifest.tree!==prepared.tree||sha256!==digest(canonical(facts))||i.manifest.byteSize!==i.manifest.files.reduce((n,f)=>n+f.byteSize,0)||new Set(i.manifest.files.map(f=>f.path.toLowerCase())).size!==i.manifest.files.length||Buffer.byteLength(canonical(i.manifest))>192*1024)fail('SOURCE_ARCHIVE_MANIFEST_INVALID');
   if(r.manifest_json){if(r.manifest_json!==canonical(i.manifest))fail('SOURCE_ARCHIVE_BASIS_CHANGED');return original;}
   if(r.state!=='SENT')fail('SOURCE_ARCHIVE_CLOSED');assertRepoFilesSettled(db,String(r.workspace_ref));exec("UPDATE source_archives SET state='PREPARED',manifest_json=?,error_code=NULL WHERE operation_id=?",canonical(i.manifest),i.operationId);return view(required(i.operationId));
  });},
  completeSourceArchive(i:SourceArchiveInput<'completeSourceArchive'>){return transaction(db,()=>{
   const r=owned(required(i.operationId),i.permit),original=view(r),a=i.acknowledgement,m=original.manifest;
   if(r.request_hash!==i.requestHash||!m||a.commit!==m.commit||a.tree!==m.tree||a.manifestSha256!==m.sha256||canonical(a.repositoryIdentity)!==canonical(original.basis.repository.identity)||a.archiveRef!=='refs/devmesh/source-archives/'+i.operationId||a.sourceRef!=='refs/devmesh/sources/'+m.commit)fail('SOURCE_ARCHIVE_ACK_UNPROVEN');
   if(original.state==='ACKNOWLEDGED'){if(canonical(original.acknowledgement)!==canonical(a))fail('SOURCE_ARCHIVE_ACK_IMMUTABLE');return original;}
   if(original.state!=='PREPARED')fail('SOURCE_ARCHIVE_CLOSED');exec("UPDATE source_archives SET state='ACKNOWLEDGED',acknowledgement_json=?,acknowledged_at=?,error_code=NULL WHERE operation_id=?",canonical(a),new Date().toISOString(),i.operationId);return view(required(i.operationId));
  });},
  markSourceArchiveUncertain(i:SourceArchiveInput<'markSourceArchiveUncertain'>){return transaction(db,()=>{const r=owned(required(i.operationId),i.permit);if(r.request_hash!==i.requestHash)fail('SOURCE_ARCHIVE_BASIS_CHANGED');if(['SENT','PREPARED'].includes(String(r.state)))exec('UPDATE source_archives SET error_code=? WHERE operation_id=?',i.errorCode,i.operationId);return view(required(i.operationId));});},
  failSourceArchive(i:SourceArchiveInput<'failSourceArchive'>){return transaction(db,()=>{const r=owned(required(i.operationId),i.permit);if(r.request_hash!==i.requestHash||r.state!=='SENT')fail('SOURCE_ARCHIVE_CLOSED');exec("UPDATE source_archives SET state='FAILED',error_code=? WHERE operation_id=?",i.errorCode,i.operationId);return view(required(i.operationId));});},
 };
 return {execute(method:SourceArchiveMethod,input:unknown){return (handlers[method] as (input:unknown)=>unknown)(parseContract(sourceArchiveRequests[method],input));}};
}
