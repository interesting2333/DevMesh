import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {isAbsolute,join,relative,sep} from 'node:path';
import {assertPermit,executionPermit,parseContract} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {workspaceRequests,approvedWorkspaceScope} from './workspace-protocol.js';
import type {ManagedRepository,WorkspaceAllocation,WorkspaceInput,WorkspaceMethod,SourceManifest} from './workspace-protocol.js';
type Row=Record<string,string|number|null>;
const time=()=>new Date().toISOString();
function fail(code:string,status=409):never{throw new StorageError(code,status,'Managed workspace action could not be applied');}
export function createWorkspaceDomain(db:DatabaseSync){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined,exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
  const repository=(id:string)=>get('SELECT * FROM managed_repositories WHERE project_id=?',id)??fail('MANAGED_REPOSITORY_NOT_FOUND',404);
  const workspace=(operationId:string)=>get('SELECT * FROM workspace_allocations WHERE operation_id=?',operationId)??fail('WORKSPACE_ALLOCATION_NOT_FOUND',404);
  function member(projectId:string,principalId:string,write=false){const m=get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',projectId,principalId);if(!m||write&&m.role==='viewer')fail('WORKSPACE_ACCESS_DENIED',403);}
  const repoView=(r:Row):ManagedRepository=>({projectId:String(r.project_id),resourceId:String(r.resource_id),operationId:String(r.operation_id),requestHash:String(r.request_hash),templateCommit:String(r.template_commit),state:String(r.state),identity:r.identity_json?JSON.parse(String(r.identity_json)):null,manifest:r.manifest_json?JSON.parse(String(r.manifest_json)):null});
  const view=(r:Row):WorkspaceAllocation=>({workspaceRef:String(r.workspace_ref),operationId:String(r.operation_id),projectId:String(r.project_id),runId:String(r.run_id),attemptId:String(r.attempt_id),activationId:String(r.activation_id),grantId:String(r.grant_id),runnerId:String(r.runner_id),kind:r.kind as WorkspaceAllocation['kind'],baseCommit:String(r.base_commit),scope:JSON.parse(String(r.scope_json)),requestHash:String(r.request_hash),state:String(r.state),identity:r.identity_json?JSON.parse(String(r.identity_json)):null,manifest:r.manifest_json?JSON.parse(String(r.manifest_json)):null,errorCode:r.error_code as string|null});
  function owned(r:Row,p:ExecutionPermit){
    if(p.ownerKind!=='workflowAttempt'||p.runId!==r.run_id||p.attemptId!==r.attempt_id||p.activationId!==r.activation_id||p.grantId!==r.grant_id||!p.resources.some(v=>v.kind==='workspace'&&v.resourceId===r.workspace_ref))fail('WORKSPACE_ALLOCATION_NOT_FOUND',404);
    const grant=get('SELECT permit_json FROM execution_grants WHERE grant_id=?',p.grantId),current=grant?parseContract(executionPermit,JSON.parse(String(grant.permit_json))):null;
    if(!current||current.ownerKind!=='workflowAttempt'||p.ownerKind!=='workflowAttempt'||current.workId!==p.workId||current.runEpoch!==p.runEpoch||current.workEpoch!==p.workEpoch)fail('WORKSPACE_ALLOCATION_NOT_FOUND',404);
    const owner=get('SELECT owner_id FROM projects WHERE project_id=?',r.project_id!);if(!owner)fail('WORKSPACE_ALLOCATION_NOT_FOUND',404);member(String(r.project_id),String(owner.owner_id));
  }
  function manifestValid(m:SourceManifest,commit:string){
    const {sha256,...basis}=m;if(m.commit!==commit||sha256!==digest(canonical(basis))||m.byteSize!==m.files.reduce((n,f)=>n+f.byteSize,0)||new Set(m.files.map(f=>f.path.toLowerCase())).size!==m.files.length)fail('WORKSPACE_SOURCE_MANIFEST_INVALID');
  }
  function identityValid(identity:WorkspaceInput<'completeManagedRepository'>['identity']){if(![identity.root,identity.gitDirectory,identity.commonDirectory].every(isAbsolute))fail('WORKSPACE_IDENTITY_INVALID');}
  function overlaps(a:string,b:string){const norm=(p:string)=>process.platform==='win32'?p.toLowerCase():p;const inside=(parent:string,child:string)=>{const r=relative(norm(parent),norm(child));return r===''||r!=='..'&&!r.startsWith('..'+sep)&&!isAbsolute(r);};return inside(a,b)||inside(b,a);}
  const handlers={
    beginManagedRepository(i:WorkspaceInput<'beginManagedRepository'>){return transaction(db,()=>{
      member(i.projectId,i.principalId,true);const requestHash=digest(canonical(i)),old=get('SELECT * FROM managed_repositories WHERE project_id=? OR operation_id=? OR resource_id=?',i.projectId,i.operationId,i.resourceId);
      if(old){if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return {...repoView(old),created:false};}
      const basis=get("SELECT 1 FROM projects p JOIN user_tasks t ON t.project_id=p.project_id WHERE p.project_id=? AND p.accepted_release_id IS NULL AND t.kind='NEW' AND t.base_commit=?",i.projectId,i.templateCommit);if(!basis)fail('MANAGED_REPOSITORY_BASE_CHANGED');const now=time();
      exec("INSERT INTO managed_repositories VALUES(?,?,?,?,?,'PREPARING',NULL,NULL,?,?)",i.projectId,i.resourceId,i.operationId,requestHash,i.templateCommit,now,now);return {...repoView(repository(i.projectId)),created:true};
    });},
    completeManagedRepository(i:WorkspaceInput<'completeManagedRepository'>){return transaction(db,()=>{
      const r=get('SELECT * FROM managed_repositories WHERE operation_id=?',i.operationId)??fail('MANAGED_REPOSITORY_NOT_FOUND',404);if(r.request_hash!==i.requestHash)fail('MANAGED_REPOSITORY_BASIS_CHANGED');manifestValid(i.manifest,String(r.template_commit));
      identityValid(i.identity);if(i.identity.root!==i.identity.gitDirectory||i.identity.root!==i.identity.commonDirectory)fail('MANAGED_REPOSITORY_IDENTITY_INVALID');
      if(r.state==='READY'){if(r.identity_json!==canonical(i.identity)||r.manifest_json!==canonical(i.manifest))fail('MANAGED_REPOSITORY_RESULT_IMMUTABLE');return repoView(r);}
      exec("UPDATE managed_repositories SET state='READY',identity_json=?,manifest_json=?,updated_at=? WHERE operation_id=?",canonical(i.identity),canonical(i.manifest),time(),i.operationId);return repoView(repository(String(r.project_id)));
    });},
    getManagedRepository(i:WorkspaceInput<'getManagedRepository'>){member(i.projectId,i.principalId);return repoView(repository(i.projectId));},
    beginWorkspaceAllocation(i:WorkspaceInput<'beginWorkspaceAllocation'>){return transaction(db,()=>{
      const {permit:p,...basis}=i,requestHash=digest(canonical({...basis,owner:{runId:p.ownerKind==='workflowAttempt'?p.runId:null,attemptId:p.ownerKind==='workflowAttempt'?p.attemptId:null,activationId:p.activationId,grantId:p.grantId}})),old=get('SELECT * FROM workspace_allocations WHERE operation_id=? OR workspace_ref=?',i.operationId,i.workspaceRef);
      if(old){owned(old,p);if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return {...view(old),created:false};}
      if(p.ownerKind!=='workflowAttempt')fail('WORKSPACE_ACCESS_DENIED',403);
      const h=get(`SELECT a.*,r.project_id,r.run_epoch,r.control_gate,r.terminal_outcome,w.work_epoch,w.blocked_reason,p.owner_id,g.status AS grant_status,g.permit_json
        FROM attempts a JOIN runs r ON r.run_id=a.run_id JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id
        JOIN projects p ON p.project_id=r.project_id JOIN execution_grants g ON g.attempt_id=a.attempt_id AND g.activation_id=? AND g.grant_id=? WHERE a.attempt_id=? AND a.run_id=?`,p.activationId,p.grantId,p.attemptId,p.runId);
      if(!h||h.grant_status!=='ACTIVE'||h.control_gate!=='OPEN'||h.terminal_outcome!==null||h.ended_at!==null||h.blocked_reason!==null||h.run_epoch!==p.runEpoch||h.work_epoch!==p.workEpoch)fail('WORKSPACE_ADMISSION_CLOSED',403);
      member(String(h!.project_id),String(h!.owner_id),true);const current=parseContract(executionPermit,JSON.parse(String(h!.permit_json)));
      assertPermit(p,current,{kind:'workspace',resourceId:i.workspaceRef,access:'write'},Date.now());assertPermit(p,current,{kind:'projectRepository',resourceId:i.repositoryResourceId,access:'read'},Date.now());
      if((i.kind==='development'&&h!.role!=='developer')||(i.kind==='verification'&&h!.role!=='tester'))fail('WORKSPACE_ROLE_DENIED',403);
      const manifest=JSON.parse(String(h!.input_manifest_json)) as {codeCommit:string};if(manifest.codeCommit!==i.baseCommit)fail('WORKSPACE_BASE_CHANGED');const repo=repository(String(h!.project_id));if(repo.state!=='READY'||repo.resource_id!==i.repositoryResourceId)fail('MANAGED_REPOSITORY_UNAVAILABLE');
      const work=get('SELECT definition_json FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?',p.runId,p.workId,Number(h!.work_revision)),scope=parseContract(approvedWorkspaceScope,(JSON.parse(String(work?.definition_json)) as {writeScope:string[]}).writeScope),now=time();
      if(i.kind==='development'&&!scope.length)fail('WORKSPACE_SCOPE_EMPTY',403);
      exec("INSERT INTO workspace_allocations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'PREPARING',NULL,NULL,NULL,?,?)",i.workspaceRef,i.operationId,String(h!.project_id),p.runId,p.attemptId,p.activationId,p.grantId,i.runnerId,i.kind,i.baseCommit,canonical(scope),requestHash,now,now);return {...view(workspace(i.operationId)),created:true};
    });},
    getWorkspaceAllocation(i:WorkspaceInput<'getWorkspaceAllocation'>){const r=workspace(i.operationId);owned(r,i.permit);return view(r);},
    getAllocationRepository(i:WorkspaceInput<'getAllocationRepository'>){const r=workspace(i.operationId);owned(r,i.permit);return repoView(repository(String(r.project_id)));},
    authorizeWorkspaceAllocation(i:WorkspaceInput<'authorizeWorkspaceAllocation'>){return transaction(db,()=>{
      const r=workspace(i.operationId),p=i.permit;owned(r,p);if(p.ownerKind!=='workflowAttempt')fail('WORKSPACE_ACCESS_DENIED',403);
      const h=get(`SELECT r.run_epoch,r.control_gate,r.terminal_outcome,w.work_epoch,w.blocked_reason,a.ended_at,g.status,g.permit_json,p.owner_id
        FROM attempts a JOIN runs r ON r.run_id=a.run_id JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id
        JOIN projects p ON p.project_id=r.project_id JOIN execution_grants g ON g.attempt_id=a.attempt_id AND g.activation_id=? AND g.grant_id=? WHERE a.attempt_id=? AND a.run_id=?`,p.activationId,p.grantId,p.attemptId,p.runId);
      if(!h||h.status!=='ACTIVE'||h.control_gate!=='OPEN'||h.terminal_outcome!==null||h.ended_at!==null||h.blocked_reason!==null||h.run_epoch!==p.runEpoch||h.work_epoch!==p.workEpoch)fail('WORKSPACE_ADMISSION_CLOSED',403);
      member(String(r.project_id),String(h!.owner_id),true);const current=parseContract(executionPermit,JSON.parse(String(h!.permit_json))),repo=repository(String(r.project_id));
      assertPermit(p,current,{kind:'workspace',resourceId:String(r.workspace_ref),access:'write'},Date.now());assertPermit(p,current,{kind:'projectRepository',resourceId:String(repo.resource_id),access:'read'},Date.now());return view(r);
    });},
    completeWorkspaceAllocation(i:WorkspaceInput<'completeWorkspaceAllocation'>){return transaction(db,()=>{
      const r=workspace(i.operationId);if(r.request_hash!==i.requestHash)fail('WORKSPACE_ALLOCATION_BASIS_CHANGED');manifestValid(i.manifest,String(r.base_commit));
      if(r.state==='READY'){if(r.identity_json!==canonical(i.identity)||r.manifest_json!==canonical(i.manifest))fail('WORKSPACE_ALLOCATION_RESULT_IMMUTABLE');return view(r);}
      if(!['PREPARING','RECONCILE'].includes(String(r.state)))fail('WORKSPACE_ALLOCATION_CLOSED');const repo=repository(String(r.project_id)),repositoryIdentity=JSON.parse(String(repo.identity_json)) as {root:string};identityValid(i.identity);if(overlaps(i.identity.root,repositoryIdentity.root)||i.identity.gitDirectory!==join(i.identity.root,'.git')||i.identity.commonDirectory!==i.identity.gitDirectory)fail('WORKSPACE_IDENTITY_INVALID');
      exec("UPDATE workspace_allocations SET state='READY',identity_json=?,manifest_json=?,error_code=NULL,updated_at=? WHERE operation_id=?",canonical(i.identity),canonical(i.manifest),time(),i.operationId);return view(workspace(i.operationId));
    });},
    markWorkspaceAllocationUncertain(i:WorkspaceInput<'markWorkspaceAllocationUncertain'>){return transaction(db,()=>{const r=workspace(i.operationId);if(r.request_hash!==i.requestHash)fail('WORKSPACE_ALLOCATION_BASIS_CHANGED');if(['PREPARING','RECONCILE'].includes(String(r.state)))exec("UPDATE workspace_allocations SET state='RECONCILE',error_code=?,updated_at=? WHERE operation_id=?",i.errorCode,time(),i.operationId);return view(workspace(i.operationId));});},
  };
  return {execute(method:WorkspaceMethod,input:unknown){return (handlers[method] as (v:unknown)=>unknown)(parseContract(workspaceRequests[method],input));}};
}
