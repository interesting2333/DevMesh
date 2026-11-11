import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {createToolAuthorityDomain} from './tool-authority-domain.js';
import {repoRequests,repoCommitArgs,repoIntegrateArgs} from './repo-protocol.js';
import type {RepoInput,RepoMethod,RepoOperation} from './repo-protocol.js';
type Row=Record<string,string|number|null>;
function fail(code:string,status=409):never{throw new StorageError(code,status,'Repository action could not be applied');}
export function createRepoDomain(db:DatabaseSync){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
  const exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p),authority=createToolAuthorityDomain(db);
  const required=(id:string)=>get('SELECT * FROM repo_operations WHERE operation_id=?',id)??fail('REPO_OPERATION_NOT_FOUND',404);
  const view=(r:Row):RepoOperation=>({operationId:String(r.operation_id),toolName:r.tool_name as RepoOperation['toolName'],requestHash:String(r.request_hash),state:String(r.state),createdAt:String(r.created_at),scope:JSON.parse(String(r.scope_json)) as string[],request:JSON.parse(String(r.request_json)) as RepoOperation['request'],prepared:r.prepared_json?JSON.parse(String(r.prepared_json)) as RepoOperation['prepared']:null,result:r.result_json?JSON.parse(String(r.result_json)) as Record<string,unknown>:null});
  function owned(r:Row,p:ExecutionPermit){authority.check(p,'repo.by-operation','read');if(p.ownerKind!=='workflowAttempt'||r.run_id!==p.runId||r.attempt_id!==p.attemptId||r.activation_id!==p.activationId||r.grant_id!==p.grantId)fail('REPO_OPERATION_NOT_FOUND',404);return r;}
  const handlers={
    beginRepoOperation(i:RepoInput<'beginRepoOperation'>){return transaction(db,()=>{
      const args=i.toolName==='repo.commit'?parseContract(repoCommitArgs,i.args):parseContract(repoIntegrateArgs,i.args);
      const request={args,binding:i.binding},requestHash=digest(canonical({toolName:i.toolName,...request})),old=get('SELECT * FROM repo_operations WHERE operation_id=?',i.operationId);
      if(old){owned(old,i.permit);if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return {...view(old),created:false};}
      const h=authority.check(i.permit,i.toolName,'write'),p=i.permit,b=i.binding;
      if(p.ownerKind!=='workflowAttempt'||b.projectId!==h.projectId||b.runId!==p.runId||b.attemptId!==p.attemptId||args.workspaceRef!==b.workspaceRef||args.baseCommit!==b.baseCommit)fail('REPO_BINDING_DENIED',403);
      const manifest=JSON.parse(String(h.host.input_manifest_json)) as {codeCommit:string};
      if(manifest.codeCommit!==b.baseCommit)fail('REPO_BASE_CHANGED');
      const kind=i.toolName==='repo.commit'?'workspace':'projectRepository',resource=i.toolName==='repo.commit'?b.resourceId:b.projectResourceId;
      if(!p.resources.some(r=>r.kind===kind&&r.resourceId===resource&&r.access==='write'))fail('REPO_RESOURCE_DENIED',403);
      const w=get('SELECT definition_json FROM work_revisions WHERE run_id=? AND work_id=? AND revision=?',p.runId,p.workId,Number(h.host.work_revision));
      const scope=(JSON.parse(String(w?.definition_json)) as {writeScope:string[]}).writeScope;
      if(!scope.length)fail('REPO_WRITE_SCOPE_EMPTY',403);
      const time=new Date().toISOString();exec("INSERT INTO repo_operations VALUES(?,?,?,?,?,?,?,?,?,'SENT',NULL,NULL,?,?)",i.operationId,p.runId,p.attemptId,p.activationId,p.grantId,i.toolName,requestHash,canonical(request),canonical(scope),time,time);
      return {...view(required(i.operationId)),created:true};
    });},
    getRepoOperation(i:RepoInput<'getRepoOperation'>){return transaction(db,()=>view(owned(required(i.operationId),i.permit)));},
    prepareRepoOperation(i:RepoInput<'prepareRepoOperation'>){return transaction(db,()=>{const r=owned(required(i.operationId),i.permit);authority.check(i.permit,String(r.tool_name),'write');if(r.request_hash!==i.requestHash)fail('REPO_OPERATION_BASIS_CHANGED');if(r.prepared_json){if(r.prepared_json!==canonical(i.prepared))fail('REPO_OPERATION_BASIS_CHANGED');return view(r);}if(r.state!=='SENT')fail('REPO_OPERATION_CLOSED');exec("UPDATE repo_operations SET state='PREPARED',prepared_json=?,updated_at=? WHERE operation_id=?",canonical(i.prepared),new Date().toISOString(),i.operationId);return view(required(i.operationId));});},
    finishRepoOperation(i:RepoInput<'finishRepoOperation'>){return transaction(db,()=>{const r=required(i.operationId);if(r.request_hash!==i.requestHash)fail('REPO_OPERATION_BASIS_CHANGED');if(r.result_json){if(r.state!==i.state||r.result_json!==canonical(i.result))fail('REPO_OPERATION_RESULT_IMMUTABLE');return view(r);}if(i.state==='SUCCEEDED'&&r.prepared_json===null)fail('REPO_COMMIT_UNPROVEN');exec('UPDATE repo_operations SET state=?,result_json=?,updated_at=? WHERE operation_id=?',i.state,canonical(i.result),new Date().toISOString(),i.operationId);return view(required(i.operationId));});},
  };
  return {execute(method:RepoMethod,input:unknown){return (handlers[method] as (i:unknown)=>unknown)(parseContract(repoRequests[method],input));}};
}
