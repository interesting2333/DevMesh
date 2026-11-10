import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { parseContract } from '@devmesh/contracts';
import { StorageError } from './errors.js';
import { canonical } from './json.js';
import { digest, transaction } from './migrations.js';
import { registryRequests } from './registry-protocol.js';
import type { RegistryMethod, RegistryInput, RegistrySnapshot, EndpointConfig, EndpointView, A2ATaskRecord } from './registry-protocol.js';

type Row=Record<string,string|number|null>;
const uid=(p:string)=>p+'_'+randomUUID().replaceAll('-','');
const now=()=>new Date().toISOString();
const reject=(code:string,message:string,status=409):never=>{throw new StorageError(code,status,message);};
const terminal=new Set(['completed','failed','canceled','rejected']);
const wireState=(state:string)=>'TASK_STATE_'+state.toUpperCase().replaceAll('-','_');
export function createRegistryDomain(db:DatabaseSync){
 const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
 const all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[];
 const exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
 const required=(r:Row|undefined)=>r??reject('RESOURCE_NOT_FOUND','Requested record does not exist',404);
 const control=()=>get('SELECT c.*,g.manifest_revision,g.manifest_hash FROM registry_control c JOIN registry_generations g ON g.generation_id=c.active_generation_id WHERE singleton_id=1');
 const bump=()=>exec('UPDATE registry_control SET projection_revision=projection_revision+1 WHERE singleton_id=1');
 const endpoint=(id:string,rev:number):EndpointView=>{
  const r=required(get('SELECT e.*,s.lifecycle,s.last_applied_sequence,s.latest_check_id,c.status,c.expires_at FROM endpoint_registrations e JOIN endpoint_runtime_state s ON s.endpoint_id=e.endpoint_id AND s.revision=e.revision LEFT JOIN endpoint_checks c ON c.check_id=s.latest_check_id WHERE e.endpoint_id=? AND e.revision=?',id,rev));
  return {config:JSON.parse(String(r.config_json)) as EndpointConfig,configHash:String(r.config_hash),lifecycle:String(r.lifecycle),checkId:r.latest_check_id===null?null:String(r.latest_check_id),status:String(r.status??'UNKNOWN'),expiresAt:r.expires_at===null?null:String(r.expires_at),checkSequence:Number(r.last_applied_sequence)};
 };
 const snapshot=():RegistrySnapshot=>{
  const c=control();if(!c)return {generationId:null,projectionRevision:0,manifestRevision:null,manifestHash:null,endpoints:[],bindings:[]};
  return {generationId:String(c.active_generation_id),projectionRevision:Number(c.projection_revision),manifestRevision:String(c.manifest_revision),manifestHash:String(c.manifest_hash),endpoints:all('SELECT endpoint_id,revision FROM endpoint_registrations ORDER BY endpoint_id,revision').map(e=>endpoint(String(e.endpoint_id),Number(e.revision))),bindings:all('SELECT role,endpoint_id,endpoint_revision FROM role_endpoint_bindings WHERE generation_id=? ORDER BY role',String(c.active_generation_id)).map(r=>({role:String(r.role),endpointId:String(r.endpoint_id),revision:Number(r.endpoint_revision)}))};
 };
 function available(id:string,rev:number,hash?:string){
  const e=endpoint(id,rev);
  if(e.lifecycle!=='ACTIVE'||!e.config.enabled||e.status!=='HEALTHY'||!e.expiresAt||e.expiresAt<=now())reject('ENDPOINT_UNAVAILABLE','Endpoint is not active with a current compatible health check',503);
  if(hash&&e.config.cardHash!==hash)reject('ENDPOINT_CARD_CHANGED','Frozen card hash differs');return e;
 }
 function applyCheck(input:RegistryInput<'recordEndpointCheck'>){
  const t=required(get('SELECT * FROM registry_probe_tickets WHERE check_id=?',input.checkId)),e=endpoint(String(t.endpoint_id),Number(t.endpoint_revision));
  if(t.config_hash!==e.configHash)reject('PROBE_BASIS_CHANGED','Probe configuration differs');
  if(input.checkedAt<String(t.issued_at)||input.expiresAt<=input.checkedAt||Date.parse(input.expiresAt)-Date.parse(input.checkedAt)>300000||Date.parse(input.checkedAt)>Date.now()+5000)reject('PROBE_TIME_INVALID','Health result has invalid observation or expiry');
  const previous=get('SELECT * FROM endpoint_checks WHERE check_id=?',input.checkId);
  const status=input.status==='HEALTHY'&&input.observedCardHash!==e.config.cardHash?'NEEDS_REVIEW':input.status;
  if(previous){if(previous.status!==status||previous.observed_card_hash!==input.observedCardHash||previous.checked_at!==input.checkedAt||previous.expires_at!==input.expiresAt||previous.error_code!==input.errorCode)reject('PROBE_RESULT_CONFLICT','A probe result is immutable');return false;}
  exec('INSERT INTO endpoint_checks VALUES(?,?,?,?,?,?,?,?,?)',input.checkId,String(t.endpoint_id),Number(t.endpoint_revision),Number(t.check_sequence),status,input.observedCardHash,input.checkedAt,input.expiresAt,input.errorCode);
  if(Number(t.check_sequence)<=e.checkSequence)return false;
  exec('UPDATE endpoint_runtime_state SET latest_check_id=?,last_applied_sequence=?,changed_at=? WHERE endpoint_id=? AND revision=?',input.checkId,Number(t.check_sequence),now(),String(t.endpoint_id),Number(t.endpoint_revision));return true;
 }
 const taskRow=(caller:string,id:string,taskId:string)=>required(get('SELECT t.*,o.caller_id,o.endpoint_revision,o.status_revision,o.cancel_requested FROM a2a_tasks t JOIN a2a_task_ownership o ON o.endpoint_id=t.endpoint_id AND o.task_id=t.task_id WHERE t.endpoint_id=? AND t.task_id=? AND o.caller_id=?',id,taskId,caller));
 const taskView=(r:Row):A2ATaskRecord=>({endpointId:String(r.endpoint_id),taskId:String(r.task_id),contextId:String(r.context_id),state:String(r.protocol_state),revision:Number(r.status_revision),cancelRequested:r.cancel_requested===1,snapshot:JSON.parse(String(r.snapshot_json)) as Record<string,unknown>});
 const internalTask=(id:string,taskId:string)=>required(get('SELECT t.*,o.caller_id,o.endpoint_revision,o.status_revision,o.cancel_requested FROM a2a_tasks t JOIN a2a_task_ownership o ON o.endpoint_id=t.endpoint_id AND o.task_id=t.task_id WHERE t.endpoint_id=? AND t.task_id=?',id,taskId));
 function updateTask(r:Row,state:string,body?:Record<string,unknown>){
  const current=JSON.parse(String(r.snapshot_json)) as Record<string,unknown>,data=body??{...current,status:{state:wireState(state),timestamp:now()}};
  if(data.id!==r.task_id||data.contextId!==r.context_id||(data.status as {state?:unknown}|undefined)?.state!==wireState(state))reject('TASK_SNAPSHOT_INVALID','Snapshot identity/state must match the persisted Task',422);
  data.metadata={...(data.metadata as Record<string,unknown>),cancelRequested:r.cancel_requested===1};
  const text=canonical(data),rev=Number(r.status_revision)+1;
  if(Buffer.byteLength(text)>128*1024)reject('TASK_SNAPSHOT_TOO_LARGE','Use content references for large bodies',413);
  exec('UPDATE a2a_tasks SET protocol_state=?,snapshot_json=? WHERE endpoint_id=? AND task_id=?',state,text,String(r.endpoint_id),String(r.task_id));
  exec('UPDATE a2a_task_ownership SET status_revision=?,updated_at=? WHERE endpoint_id=? AND task_id=?',rev,now(),String(r.endpoint_id),String(r.task_id));
  exec('INSERT INTO a2a_task_events VALUES(?,?,?,?,?)',String(r.endpoint_id),String(r.task_id),rev,text,now());
  return taskView(internalTask(String(r.endpoint_id),String(r.task_id)));
 }
 function validateDelegation(d:RegistryInput<'acceptA2AWork'>['delegation'],caller:string){
  const a=required(get('SELECT a.*,r.control_gate,r.terminal_outcome,r.run_epoch,r.current_plan_revision,r.current_requirement_revision,w.work_epoch FROM attempts a JOIN runs r ON r.run_id=a.run_id JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id WHERE a.attempt_id=?',d.attemptId));
  const b=required(get('SELECT * FROM attempt_dispatch_bindings WHERE attempt_id=?',d.attemptId));
  const e=available(d.endpointId,d.endpointRevision),g=required(get('SELECT * FROM execution_grants WHERE grant_id=? AND attempt_id=? AND activation_id=?',d.grantId,d.attemptId,d.activationId));
  const p=JSON.parse(String(g.permit_json)) as {notBefore:string;runEpoch:number;workEpoch:number};
  const role=JSON.parse(String(a.role_snapshot_json)) as {outputSchemaId:string};
  if(!e.config.allowedCallers.includes(caller))reject('CALLER_NOT_ALLOWED','Service caller cannot invoke this endpoint',403);
  if(a.run_id!==d.runId||a.work_id!==d.workId||a.work_revision!==d.workRevision||a.role!==d.targetRole||a.dispatch_operation_id!==d.operationId||b.endpoint_id!==d.endpointId||b.endpoint_revision!==d.endpointRevision||b.input_manifest_id!==d.inputManifestId||b.role_snapshot_id!==d.roleSnapshotId||a.current_plan_revision!==d.planRevision||a.current_requirement_revision!==d.requirementRevision)reject('DELEGATION_BASIS_CHANGED','Delegation differs from frozen dispatch authority',403);
  if(role.outputSchemaId!==d.requestedOutputSchema)reject('DELEGATION_BASIS_CHANGED','Requested output schema differs from the frozen role snapshot',403);
  if(a.control_gate!=='OPEN'||a.terminal_outcome!==null||a.ended_at!==null||a.run_epoch!==d.runEpoch||a.work_epoch!==d.workEpoch||g.status!=='ACTIVE'||String(g.expires_at)<=now()||p.notBefore>now()||p.runEpoch!==d.runEpoch||p.workEpoch!==d.workEpoch)reject('EXECUTION_PERMIT_INVALID','Execution gate, epoch or grant is no longer valid',403);
  return {a,b};
 }
 const handlers={
  getRegistrySnapshot(){return transaction(db,snapshot);},
  issueEndpointProbe(input:RegistryInput<'issueEndpointProbe'>){return transaction(db,()=>{const e=input.endpoint,hash=digest(canonical(e)),old=get('SELECT config_hash FROM endpoint_registrations WHERE endpoint_id=? AND revision=?',e.endpointId,e.revision);if(old&&old.config_hash!==hash)reject('ENDPOINT_REVISION_REUSED','Endpoint revision is immutable');const seq=Number(get('SELECT max(check_sequence) n FROM registry_probe_tickets WHERE endpoint_id=? AND endpoint_revision=?',e.endpointId,e.revision)?.n??0)+1,id=uid('check');exec('INSERT INTO registry_probe_tickets VALUES(?,?,?,?,?,?)',id,e.endpointId,e.revision,seq,hash,now());return {checkId:id,sequence:seq};});},
  commitRegistry(input:RegistryInput<'commitRegistry'>){return transaction(db,()=>{
   const manifest=input.manifest,hash=digest(canonical(manifest)),c=control(),previous=get('SELECT * FROM registry_imports WHERE manifest_revision=?',manifest.manifestRevision);
   if(previous&&previous.manifest_hash!==hash)reject('MANIFEST_REVISION_REUSED','Same manifest revision has different content');
   if(previous&&previous.generation_id!==c?.active_generation_id)reject('MANIFEST_ROLLBACK_FORBIDDEN','Publish a new revision to select historical configuration');
   if(Number(c?.projection_revision??0)!==input.expectedProjectionRevision)reject('REGISTRY_VERSION_CHANGED','Registry projection changed during validation');
   for(const e of manifest.endpoints){const configHash=digest(canonical(e)),old=get('SELECT * FROM endpoint_registrations WHERE endpoint_id=? AND revision=?',e.endpointId,e.revision);if(old&&old.config_hash!==configHash)reject('ENDPOINT_REVISION_REUSED','Endpoint version cannot change');if(!old){exec('INSERT INTO endpoint_registrations VALUES(?,?,?,?,?)',e.endpointId,e.revision,configHash,canonical(e),now());exec('INSERT INTO endpoint_runtime_state VALUES(?,?,?,NULL,0,?,?)',e.endpointId,e.revision,e.enabled?'ACTIVE':'DRAINING',e.enabled?null:'manifest-disabled',now());}}
   const expected=new Set(manifest.endpoints.map(e=>e.endpointId+':'+e.revision));
   for(const check of input.checks){const ticket=required(get('SELECT * FROM registry_probe_tickets WHERE check_id=?',check.checkId));if(!expected.has(ticket.endpoint_id+':'+ticket.endpoint_revision))reject('PROBE_OUTSIDE_MANIFEST','Probe belongs to a different manifest endpoint');applyCheck(check);}
   // Every configured endpoint needs a probe fact for this startup, including failed probes.
   for(const e of manifest.endpoints)if(!input.checks.some(check=>{const t=get('SELECT endpoint_id,endpoint_revision FROM registry_probe_tickets WHERE check_id=?',check.checkId);return t?.endpoint_id===e.endpointId&&t.endpoint_revision===e.revision;}))reject('MANIFEST_CHECKS_INCOMPLETE','Check every configured endpoint before committing');
   if(!previous){const gen=uid('generation');exec('INSERT INTO registry_generations VALUES(?,?,?,?,?)',gen,manifest.manifestRevision,hash,canonical(manifest),now());exec('INSERT INTO registry_imports VALUES(?,?,?,?)',manifest.manifestRevision,hash,gen,now());for(const e of manifest.endpoints)if(e.role&&e.enabled)exec('INSERT INTO role_endpoint_bindings VALUES(?,?,?,?)',gen,e.role,e.endpointId,e.revision);
    for(const old of all("SELECT endpoint_id,revision FROM endpoint_runtime_state WHERE lifecycle='ACTIVE'"))if(!manifest.endpoints.some(e=>e.endpointId===old.endpoint_id&&e.revision===old.revision&&e.enabled))exec("UPDATE endpoint_runtime_state SET lifecycle='DRAINING',drain_reason='manifest-removed',changed_at=? WHERE endpoint_id=? AND revision=?",now(),String(old.endpoint_id),Number(old.revision));
    if(c)exec('UPDATE registry_control SET active_generation_id=?,projection_revision=projection_revision+1,activated_at=? WHERE singleton_id=1',gen,now());else exec('INSERT INTO registry_control VALUES(1,?,1,?)',gen,now());
   }else bump();return snapshot();
  });},
  recordEndpointCheck(input:RegistryInput<'recordEndpointCheck'>){return transaction(db,()=>{const applied=applyCheck(input);if(applied)bump();return {applied,projectionRevision:Number(control()?.projection_revision??0)};});},
  setEndpointLifecycle(input:RegistryInput<'setEndpointLifecycle'>){return transaction(db,()=>{const e=endpoint(input.endpointId,input.revision);if(input.lifecycle==='ACTIVE'&&(e.status!=='HEALTHY'||!e.expiresAt||e.expiresAt<=now()||!e.config.enabled))reject('ENDPOINT_UNAVAILABLE','Explicit activation requires compatible current health');if(input.lifecycle==='RETIRED'&&get('SELECT b.attempt_id FROM attempt_dispatch_bindings b JOIN attempts a ON a.attempt_id=b.attempt_id JOIN runs r ON r.run_id=a.run_id WHERE b.endpoint_id=? AND b.endpoint_revision=? AND r.terminal_outcome IS NULL',input.endpointId,input.revision))reject('ENDPOINT_IN_USE','Endpoint is frozen by a nonterminal Run');if(input.lifecycle==='RETIRED'&&get('SELECT t.task_id FROM a2a_tasks t JOIN a2a_task_ownership o ON o.endpoint_id=t.endpoint_id AND o.task_id=t.task_id WHERE t.endpoint_id=? AND o.endpoint_revision=? AND t.protocol_state NOT IN (\'completed\',\'failed\',\'canceled\',\'rejected\')',input.endpointId,input.revision))reject('ENDPOINT_IN_USE','Endpoint has nonterminal tasks');exec('UPDATE endpoint_runtime_state SET lifecycle=?,drain_reason=?,changed_at=? WHERE endpoint_id=? AND revision=?',input.lifecycle,input.lifecycle==='ACTIVE'?null:input.reason,now(),input.endpointId,input.revision);exec('INSERT INTO registry_audit VALUES(?,?,?,?,?,?,?)',uid('audit'),input.actorId,input.endpointId,input.revision,input.lifecycle,input.reason,now());bump();return snapshot();});},
  assertRegistryTarget(input:RegistryInput<'assertRegistryTarget'>){return transaction(db,()=>{const c=required(control());if(c.active_generation_id!==input.generationId||c.projection_revision!==input.projectionRevision)reject('REGISTRY_PROJECTION_STALE','Refresh registry before executing',503);if(input.role&&!get('SELECT role FROM role_endpoint_bindings WHERE generation_id=? AND role=? AND endpoint_id=? AND endpoint_revision=?',input.generationId,input.role,input.endpointId,input.revision))reject('REGISTRY_BINDING_CHANGED','Default role binding differs');return available(input.endpointId,input.revision,input.cardHash);});},
  acceptA2AWork(input:RegistryInput<'acceptA2AWork'>){return transaction(db,()=>{
   const d=input.delegation,hash=digest(canonical({endpointId:input.endpointId,endpointRevision:d.endpointRevision,delegation:d,message:input.message})),old=get('SELECT * FROM delegation_inbox WHERE caller_id=? AND operation_id=?',input.callerId,d.operationId);
   if(old){if(old.request_hash!==hash)reject('IDEMPOTENCY_KEY_REUSED','Original operation belongs to a different A2A request');return taskView(taskRow(input.callerId,String(old.endpoint_id),String(old.task_id)));}
   if(d.endpointId!==input.endpointId||d.endpointRevision!==input.endpointRevision)reject('ENDPOINT_REVISION_UNAVAILABLE','Requested implementation is not hosted by this route');
   const {b}=validateDelegation(d,input.callerId),c=required(control());if(c.projection_revision!==input.projectionRevision||b.registry_generation_id!==input.generationId)reject('REGISTRY_PROJECTION_STALE','Registry projection is not current',503);
   if(get('SELECT task_id FROM a2a_tasks WHERE attempt_id=?',d.attemptId))reject('ATTEMPT_ALREADY_ACCEPTED','An Attempt already has a task');
   const id=randomUUID(),context=randomUUID(),time=now(),body={id,contextId:context,status:{state:wireState('submitted'),timestamp:time},history:[input.message],metadata:{operationId:d.operationId,endpointRevision:d.endpointRevision},artifacts:[]},text=canonical(body);
   exec('INSERT INTO a2a_tasks VALUES(?,?,?,?,?,?,?)',input.endpointId,id,context,d.runId,d.attemptId,'submitted',text);
   exec('INSERT INTO a2a_task_ownership VALUES(?,?,?,?,1,0,?,?)',input.endpointId,id,input.callerId,input.endpointRevision,time,time);
   exec('INSERT INTO delegation_inbox VALUES(?,?,?,?,?,?)',input.callerId,d.operationId,hash,input.endpointId,id,time);
   exec("INSERT INTO accepted_work(endpoint_id,task_id,state,activation_id) VALUES(?,?,'PENDING',?)",input.endpointId,id,d.activationId);
   exec('INSERT INTO a2a_task_events VALUES(?,?,1,?,?)',input.endpointId,id,text,time);
   return taskView(taskRow(input.callerId,input.endpointId,id));
  });},
  getA2ATask(input:RegistryInput<'getA2ATask'>){return taskView(taskRow(input.callerId,input.endpointId,input.taskId));},
  listA2ATasks(input:RegistryInput<'listA2ATasks'>){return transaction(db,()=>{const rows=all('SELECT t.*,o.status_revision,o.cancel_requested FROM a2a_tasks t JOIN a2a_task_ownership o ON o.endpoint_id=t.endpoint_id AND o.task_id=t.task_id WHERE o.caller_id=? AND t.endpoint_id=? AND t.task_id>? ORDER BY t.task_id LIMIT ?',input.callerId,input.endpointId,input.afterId??'',input.limit+1),tasks=rows.slice(0,input.limit).map(taskView);return {tasks,nextPageToken:rows.length>input.limit?tasks.at(-1)!.taskId:'',totalSize:Number(get('SELECT count(*) n FROM a2a_task_ownership WHERE caller_id=? AND endpoint_id=?',input.callerId,input.endpointId)?.n??0)};});},
  listA2ATaskEvents(input:RegistryInput<'listA2ATaskEvents'>){return transaction(db,()=>{taskRow(input.callerId,input.endpointId,input.taskId);return all('SELECT seq,snapshot_json FROM a2a_task_events WHERE endpoint_id=? AND task_id=? AND seq>? ORDER BY seq LIMIT 100',input.endpointId,input.taskId,input.afterSeq).map(r=>({seq:Number(r.seq),snapshot:JSON.parse(String(r.snapshot_json)) as Record<string,unknown>}));});},
  cancelA2ATask(input:RegistryInput<'cancelA2ATask'>){return transaction(db,()=>{const r=taskRow(input.callerId,input.endpointId,input.taskId);if(r.protocol_state==='canceled'||r.cancel_requested===1)return taskView(r);if(terminal.has(String(r.protocol_state)))reject('TASK_NOT_CANCELABLE','Task is terminal');exec('UPDATE a2a_task_ownership SET cancel_requested=1 WHERE endpoint_id=? AND task_id=?',input.endpointId,input.taskId);r.cancel_requested=1;const pending=get("SELECT task_id FROM accepted_work WHERE endpoint_id=? AND task_id=? AND state='PENDING'",input.endpointId,input.taskId);if(pending)exec("UPDATE accepted_work SET state='FINISHED' WHERE endpoint_id=? AND task_id=?",input.endpointId,input.taskId);return updateTask(r,pending?'canceled':String(r.protocol_state));});},
  claimAcceptedWork(input:RegistryInput<'claimAcceptedWork'>){return transaction(db,()=>{
   const result=[];for(const r of all("SELECT task_id FROM accepted_work WHERE endpoint_id=? AND state='PENDING' ORDER BY task_id LIMIT ?",input.endpointId,input.limit)){
    const t=internalTask(input.endpointId,String(r.task_id)),body=JSON.parse(String(t.snapshot_json)) as {history:{parts:{data?:unknown}[]}[]};
    const d=parseContract(registryRequests.acceptA2AWork.shape.delegation,body.history[0]?.parts[0]?.data);validateDelegation(d,String(t.caller_id));
    const token=uid('claim');exec("UPDATE accepted_work SET state='ACTIVE',worker_id=?,claim_token=?,claimed_at=? WHERE endpoint_id=? AND task_id=?",input.workerId,token,now(),input.endpointId,String(r.task_id));updateTask(t,'working');result.push({endpointId:input.endpointId,taskId:String(r.task_id),workerId:input.workerId,claimToken:token,delegation:d});
   }return result;
  });},
  settleAcceptedWork(input:RegistryInput<'settleAcceptedWork'>){return transaction(db,()=>{const a=required(get('SELECT * FROM accepted_work WHERE endpoint_id=? AND task_id=?',input.endpointId,input.taskId)),r=internalTask(input.endpointId,input.taskId);if(a.worker_id!==input.workerId||a.claim_token!==input.claimToken||a.state!=='ACTIVE')reject('ACCEPTED_WORK_CLAIM_CHANGED','Only current active consumer can update Task');if(input.state==='canceled'&&(!input.stopVerified||get("SELECT operation_id FROM tool_operations WHERE attempt_id=? AND operation_id IN (SELECT operation_id FROM operations WHERE status NOT IN ('SUCCEEDED','FAILED'))",String(r.attempt_id))||get("SELECT j.job_id FROM runner_jobs j JOIN tool_operations t ON t.operation_id=j.operation_id WHERE t.attempt_id=? AND j.state<>'EXITED'",String(r.attempt_id))))reject('STOP_NOT_VERIFIED','Cancellation needs known stopped effects');const result=updateTask(r,input.state,input.snapshot);exec('UPDATE accepted_work SET state=? WHERE endpoint_id=? AND task_id=?',terminal.has(input.state)?'FINISHED':['input-required','auth-required'].includes(input.state)?'WAITING':'ACTIVE',input.endpointId,input.taskId);return result;});},
  recoverAcceptedWork(){return transaction(db,()=>({reconcileCount:Number(exec("UPDATE accepted_work SET state='RECONCILE' WHERE state='ACTIVE'").changes)}));},
 };
 return {
  freezeDispatch(attemptId:string,role:string,target:{endpointId:string;revision:number;cardHash:string;registryGenerationId:string},fingerprint:string,roleSnapshotId:string){
   const c=control();if(!c)return null; // Legacy trusted storage fixtures have no deployed Registry.
   if(c.active_generation_id!==target.registryGenerationId||!get('SELECT role FROM role_endpoint_bindings WHERE generation_id=? AND role=? AND endpoint_id=? AND endpoint_revision=?',target.registryGenerationId,role,target.endpointId,target.revision))reject('REGISTRY_BINDING_CHANGED','Requested role binding differs from active Registry');
   available(target.endpointId,target.revision,target.cardHash);
   const id=uid('manifest');exec('INSERT INTO attempt_dispatch_bindings VALUES(?,?,?,?,?,?,?,?)',attemptId,target.endpointId,target.revision,target.registryGenerationId,Number(c.projection_revision),id,fingerprint,roleSnapshotId);return id;
  },
  execute(method:RegistryMethod,input:unknown){const parsed=parseContract(registryRequests[method],input);return (handlers[method] as (p:unknown)=>unknown)(parsed);},
 };
}
