import {createHash,randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {canonical} from '@devmesh/storage-sqlite';
import {RunnerError} from './protocol.js';
import type {StoreInput} from './store-protocol.js';
import type {WorkspaceBinding,WorkspaceFence} from './workspace-fence.js';
import {workspaceFenceSchema} from './workspace-fence.js';

const migration=`
ALTER TABLE runner_identity RENAME TO runner_identity_v1;
CREATE TABLE runner_identity(singleton INTEGER PRIMARY KEY CHECK(singleton=1),runner_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version=2)) STRICT;
INSERT INTO runner_identity SELECT singleton,runner_id,2 FROM runner_identity_v1;
DROP TABLE runner_identity_v1;
CREATE TABLE runner_schema_history(version INTEGER PRIMARY KEY,sha256 TEXT NOT NULL,applied_at TEXT NOT NULL) STRICT;
CREATE TABLE workspace_bindings(workspace_ref TEXT PRIMARY KEY,binding_json TEXT NOT NULL CHECK(json_valid(binding_json)),created_at TEXT NOT NULL) STRICT;
CREATE TRIGGER immutable_workspace_binding BEFORE UPDATE ON workspace_bindings BEGIN SELECT RAISE(ABORT,'WORKSPACE_BINDING_IMMUTABLE'); END;
CREATE TABLE workspace_fences(fence_id TEXT PRIMARY KEY,controller_id TEXT NOT NULL,operation_id TEXT NOT NULL,workspace_ref TEXT NOT NULL,workspace_path TEXT NOT NULL,holder_token TEXT NOT NULL,request_hash TEXT NOT NULL,request_json TEXT NOT NULL CHECK(json_valid(request_json)),state TEXT NOT NULL CHECK(state IN ('ACTIVE','RELEASED')),created_at TEXT NOT NULL,released_at TEXT,UNIQUE(controller_id,operation_id),CHECK((state='ACTIVE' AND released_at IS NULL) OR (state='RELEASED' AND released_at IS NOT NULL))) STRICT;
CREATE UNIQUE INDEX exclusive_workspace_fence ON workspace_fences(workspace_path) WHERE state='ACTIVE';
CREATE TRIGGER immutable_workspace_fence BEFORE UPDATE ON workspace_fences WHEN OLD.state='RELEASED' OR NEW.fence_id<>OLD.fence_id OR NEW.controller_id<>OLD.controller_id OR NEW.operation_id<>OLD.operation_id OR NEW.workspace_ref<>OLD.workspace_ref OR NEW.workspace_path<>OLD.workspace_path OR NEW.holder_token<>OLD.holder_token OR NEW.request_hash<>OLD.request_hash OR NEW.request_json<>OLD.request_json OR NEW.created_at<>OLD.created_at BEGIN SELECT RAISE(ABORT,'WORKSPACE_FENCE_IMMUTABLE'); END;
PRAGMA user_version=2;`;
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
type Row=Record<string,string|number|null>;
const fail=(code:string,status=409):never=>{throw new RunnerError(code,status);};
export function createRunnerFenceDomain(db:DatabaseSync){
  const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as Row|undefined;
  const exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
  const transaction=<T>(body:()=>T):T=>{db.exec('BEGIN IMMEDIATE');try{const result=body();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
  const version=Number(Object.values(db.prepare('PRAGMA user_version').get()!)[0]);
  if(version===1)transaction(()=>{db.exec(migration);exec('INSERT INTO runner_schema_history VALUES(2,?,?)',hash(migration),new Date().toISOString());});
  else if(![2,3].includes(version))fail('RUNNER_STORE_IDENTITY_MISMATCH');
  if(get('SELECT sha256 FROM runner_schema_history WHERE version=2')?.sha256!==hash(migration)||get('SELECT version FROM runner_identity WHERE singleton=1')?.version!==(version===1?2:version))fail('RUNNER_MIGRATION_DRIFT');
  const view=(r:Row):WorkspaceFence=>workspaceFenceSchema.parse({fenceId:String(r.fence_id),controllerId:String(r.controller_id),operationId:String(r.operation_id),workspaceRef:String(r.workspace_ref),workspacePath:String(r.workspace_path),holderToken:String(r.holder_token),requestHash:String(r.request_hash),request:JSON.parse(String(r.request_json)),state:r.state,createdAt:String(r.created_at),releasedAt:r.released_at});
  const owned=(controllerId:string,fenceId:string)=>{const row=get('SELECT * FROM workspace_fences WHERE fence_id=? AND controller_id=?',fenceId,controllerId);return row??fail('WORKSPACE_FENCE_NOT_FOUND',404);};
  const assertAvailable=(workspacePath:string)=>{if(get("SELECT 1 FROM workspace_fences WHERE workspace_path=? AND state='ACTIVE'",workspacePath))fail('RUNNER_WORKSPACE_FENCED',423);};
  return {
    assertAvailable,
    fenceAcquire(i:StoreInput<'fenceAcquire'>){return transaction(()=>{
      const requestHash=hash(canonical({request:i.request,binding:i.binding,workspacePath:i.workspacePath})),old=get('SELECT * FROM workspace_fences WHERE controller_id=? AND operation_id=?',i.controllerId,i.request.operationId);
      if(old){if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return view(old);}
      assertAvailable(i.workspacePath);
      // Includes QUEUED and every unknown/stopping job, across all controllers.
      if(get("SELECT 1 FROM jobs WHERE state<>'EXITED' AND json_extract(execution_json,'$.workspacePath')=?",i.workspacePath))fail('RUNNER_WORKSPACE_BUSY');
      const prior=get('SELECT binding_json FROM workspace_bindings WHERE workspace_ref=?',i.request.workspaceRef),binding=canonical(i.binding),now=new Date().toISOString();
      if(prior&&prior.binding_json!==binding)fail('RUNNER_WORKSPACE_BINDING_CHANGED');
      if(!prior)exec('INSERT INTO workspace_bindings VALUES(?,?,?)',i.request.workspaceRef,binding,now);
      const id='fence_'+randomUUID().replaceAll('-','');exec("INSERT INTO workspace_fences VALUES(?,?,?,?,?,?,?,?,'ACTIVE',?,NULL)",id,i.controllerId,i.request.operationId,i.request.workspaceRef,i.workspacePath,i.request.holderToken,requestHash,canonical(i.request),now);return view(owned(i.controllerId,id));
    });},
    fenceGet(i:StoreInput<'fenceGet'>){return view(owned(i.controllerId,i.fenceId));},
    fenceByOperation(i:StoreInput<'fenceByOperation'>){const row=get('SELECT * FROM workspace_fences WHERE controller_id=? AND operation_id=?',i.controllerId,i.operationId);return row?view(row):null;},
    fenceActive(i:StoreInput<'fenceActive'>){const row=get("SELECT * FROM workspace_fences WHERE controller_id=? AND workspace_ref=? AND state='ACTIVE'",i.controllerId,i.workspaceRef);return row?view(row):null;},
    fenceRelease(i:StoreInput<'fenceRelease'>){return transaction(()=>{const row=owned(i.controllerId,i.fenceId);if(row.holder_token!==i.release.holderToken||row.request_hash!==i.release.requestHash)fail('RUNNER_WORKSPACE_FENCE_OWNER_CHANGED',403);if(row.state==='ACTIVE')exec("UPDATE workspace_fences SET state='RELEASED',released_at=? WHERE fence_id=?",new Date().toISOString(),i.fenceId);return view(owned(i.controllerId,i.fenceId));});},
    workspaceBinding(i:StoreInput<'workspaceBinding'>):WorkspaceBinding|null{const row=get('SELECT binding_json FROM workspace_bindings WHERE workspace_ref=?',i.workspaceRef);return row?JSON.parse(String(row.binding_json)) as WorkspaceBinding:null;},
  };
}
