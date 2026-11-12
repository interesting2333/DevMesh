import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {roleOutput} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest} from './migrations.js';
import type {RuntimeWorkspaceResult} from './runtime-protocol.js';
type Row=Record<string,string|number|null>;
function fail(code:string):never{throw new StorageError(code,409,'Managed runtime result could not be verified');}
export function createRuntimeWorkspaces(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
 function managed(a:Row){const config=JSON.parse(String(a.config_json)) as {workspace?:{schemaVersion:string;runnerId:string}};return config.workspace??null;}
 function allocation(a:Row){const config=managed(a);if(!config||config.schemaVersion!=='devmesh.managed-runtime.v1')fail('RUNTIME_WORKSPACE_NOT_CONFIGURED');
  const rows=db.prepare('SELECT * FROM workspace_allocations WHERE activation_id=? AND attempt_id=? AND grant_id=?').all(String(a.activation_id),String(a.attempt_id),String(a.grant_id)) as Row[];
  if(rows.length!==1)fail('RUNTIME_WORKSPACE_ALLOCATION_UNPROVEN');const w=rows[0]!;
  if(w.state!=='READY'||!w.identity_json||!w.manifest_json||w.runner_id!==config!.runnerId)fail('RUNTIME_WORKSPACE_ALLOCATION_UNPROVEN');return w;
 }
 function view(r:Row):RuntimeWorkspaceResult{return {activationId:String(r.activation_id),allocationOperationId:String(r.allocation_operation_id),commitOperationId:r.commit_operation_id as string|null,archiveOperationId:r.archive_operation_id as string|null,stepNo:Number(r.step_no),contentHash:String(r.content_hash),output:JSON.parse(String(r.output_json))};}
 function prepare(a:Row,stepNo:number,contentHash:string,raw:Record<string,unknown>){
  const output=roleOutput.parse(raw),old=get('SELECT * FROM runtime_workspace_results WHERE activation_id=?',a.activation_id!);
  if(old){if(old.content_hash!==contentHash||old.output_json!==canonical(output)||old.step_no!==stepNo)fail('RUNTIME_WORKSPACE_RESULT_IMMUTABLE');return view(old);}
  const w=allocation(a),attempt=get('SELECT * FROM attempts WHERE attempt_id=?',a.attempt_id!);if(!attempt||output.role!==attempt.role)fail('RUNTIME_WORKSPACE_ROLE_CHANGED');
  const input=JSON.parse(String(attempt.input_manifest_json)) as {codeCommit:string};if(w.base_commit!==input.codeCommit)fail('RUNTIME_WORKSPACE_BASE_CHANGED');
  if(digest(canonical(output))!==contentHash||!get("SELECT 1 FROM content_objects WHERE content_hash=? AND state='READY'",contentHash))fail('RESULT_HASH_MISMATCH');
  if(!get("SELECT 1 FROM model_steps m JOIN runtime_model_accounting c ON c.session_id=m.session_id AND c.step_no=m.step_no WHERE m.session_id=? AND m.step_no=? AND m.state='RESPONDED' AND c.activation_id=?",a.session_id!,stepNo,a.activation_id!))fail('MODEL_RESPONSE_NOT_DURABLE');
  if(get("SELECT 1 FROM runtime_tool_calls WHERE activation_id=? AND state NOT IN ('FAILED','SUCCEEDED')",a.activation_id!))fail('TOOL_OUTCOME_UNKNOWN');
  let commitId:string|null=null,archiveId:string|null=null;
  if(output.role==='developer'){
   if(w.kind!=='development'||output.baseCommit!==w.base_commit)fail('RUNTIME_WORKSPACE_BASE_CHANGED');
   const commits=db.prepare("SELECT * FROM repo_operations WHERE activation_id=? AND attempt_id=? AND grant_id=? AND tool_name='repo.commit' AND state='SUCCEEDED' AND json_extract(prepared_json,'$.commit')=? AND json_extract(result_json,'$.commit')=? AND json_extract(request_json,'$.binding.workspaceRef')=?").all(a.activation_id!,a.attempt_id!,a.grant_id!,output.resultCommit,output.resultCommit,w.workspace_ref!) as Row[];
   if(commits.length!==1)fail('RUNTIME_WORKSPACE_COMMIT_UNPROVEN');commitId=String(commits[0]!.operation_id);archiveId='op_'+digest('runtime-source-archive\0'+String(a.activation_id));
  }else if(output.role==='tester'){if(w.kind!=='verification'||output.targetCommit!==w.base_commit)fail('RUNTIME_WORKSPACE_BASE_CHANGED');}
  else fail('RUNTIME_WORKSPACE_ROLE_CHANGED');
  db.prepare('INSERT INTO runtime_workspace_results VALUES(?,?,?,?,?,?,?,?)').run(a.activation_id!,w.operation_id!,commitId,archiveId,stepNo,contentHash,canonical(output),new Date().toISOString());
  return view(get('SELECT * FROM runtime_workspace_results WHERE activation_id=?',a.activation_id!)!);
 }
 function assertPublication(a:Row,stepNo:number,contentHash:string,output:unknown){
  if(!managed(a))return;
  const r=get('SELECT * FROM runtime_workspace_results WHERE activation_id=?',a.activation_id!),w=allocation(a);
  if(!r||r.step_no!==stepNo||r.content_hash!==contentHash||r.output_json!==canonical(output)||r.allocation_operation_id!==w.operation_id)fail('RUNTIME_WORKSPACE_RESULT_UNPREPARED');
  if(r.archive_operation_id){const s=get('SELECT * FROM source_archives WHERE operation_id=?',r.archive_operation_id);
   if(!s||s.state!=='ACKNOWLEDGED'||s.allocation_operation_id!==w.operation_id||s.commit_operation_id!==r.commit_operation_id||s.activation_id!==a.activation_id||!s.manifest_json||!s.acknowledgement_json)fail('RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED');
   const ack=JSON.parse(String(s.acknowledgement_json)) as {commit:string;manifestSha256:string},manifest=JSON.parse(String(s.manifest_json)) as {commit:string;sha256:string},result=roleOutput.parse(output);
   if(result.role!=='developer'||ack.commit!==result.resultCommit||manifest.commit!==result.resultCommit||ack.manifestSha256!==manifest.sha256)fail('RUNTIME_SOURCE_ARCHIVE_UNACKNOWLEDGED');
  }
 }
 return {prepare,assertPublication,get(activationId:string){const r=get('SELECT * FROM runtime_workspace_results WHERE activation_id=?',activationId);return r?view(r):null;}};
}
