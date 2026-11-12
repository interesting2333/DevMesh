import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { parseContract, workDelegation } from '@devmesh/contracts';
import type { Parsed, ScheduledDispatch } from './protocol.js';
import { endpointConfig } from './registry-protocol.js';
import { StorageError } from './errors.js';
import { canonical } from './json.js';

type Row=Record<string,string|number|null>;
const now=()=>new Date().toISOString();
const join=` FROM scheduled_work s JOIN attempts a ON a.attempt_id=s.attempt_id
  JOIN runs r ON r.run_id=a.run_id JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id
  JOIN plan_revisions p ON p.run_id=s.run_id AND p.revision=s.plan_revision
  JOIN attempt_dispatch_bindings b ON b.attempt_id=a.attempt_id
  JOIN execution_grants g ON g.attempt_id=a.attempt_id
  JOIN endpoint_registrations e ON e.endpoint_id=b.endpoint_id AND e.revision=b.endpoint_revision
  JOIN outbox o ON o.operation_id=a.dispatch_operation_id AND o.destination=b.endpoint_id
  LEFT JOIN scheduled_dispatch_delivery d ON d.attempt_id=a.attempt_id`;
const fields=`SELECT s.*,a.role,a.work_id,a.work_revision,a.state AS attempt_state,a.admitted_run_epoch,a.admitted_work_epoch,a.ended_at,
  a.role_snapshot_json,a.dispatch_operation_id,r.control_gate,r.run_epoch,r.terminal_outcome,r.current_plan_revision,
  r.current_requirement_revision,w.work_epoch,p.requirement_revision,b.endpoint_id,b.endpoint_revision,b.input_manifest_id,b.role_snapshot_id,
  g.grant_id,g.activation_id,g.expires_at,g.status AS grant_status,e.config_json,o.outbox_id,d.state AS delivery_state,d.sent_at,d.checked_at`;

export function createDispatchDomain(db:DatabaseSync,changed:(runId:string,operationId:string,workId:string,attemptId:string,state:string)=>void){
  const get=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).get(...params) as Row|undefined;
  const all=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).all(...params) as Row[];
  const exec=(sql:string,...params:SQLInputValue[])=>db.prepare(sql).run(...params);
  function row(input:{attemptId:string;callerId:string}){
    const r=get(fields+join+' WHERE s.attempt_id=? AND s.caller_id=?',input.attemptId,input.callerId);
    if(!r)throw new StorageError('RESOURCE_NOT_FOUND',404,'Scheduled dispatch is not visible');
    return r;
  }
  function sendable(r:Row){
    return r.attempt_state==='RESERVED'&&r.ended_at===null&&r.terminal_outcome===null&&r.control_gate==='OPEN'&&r.admitted_run_epoch===r.run_epoch&&
      r.admitted_work_epoch===r.work_epoch&&r.plan_revision===r.current_plan_revision&&r.requirement_revision===r.current_requirement_revision&&
      r.grant_status==='ACTIVE'&&String(r.expires_at)>now();
  }
  function list(input:Parsed<'listScheduledDispatches'>):ScheduledDispatch[]{
    const rows=all(fields+join+` WHERE d.state IS NULL OR d.state IN ('SENT','RECONCILE')
      ORDER BY d.state IS NOT NULL,COALESCE(d.checked_at,a.created_at),a.attempt_id LIMIT ?`,input.limit);
    return rows.map(r=>{
      const role=JSON.parse(String(r.role_snapshot_json)) as {outputSchemaId:string};
      return {attemptId:String(r.attempt_id),callerId:String(r.caller_id),state:(r.delivery_state??'PENDING') as ScheduledDispatch['state'],
        endpoint:parseContract(endpointConfig,JSON.parse(String(r.config_json))),
        delegation:parseContract(workDelegation,{schemaVersion:'devmesh.work.v1',operationId:r.dispatch_operation_id,runId:r.run_id,
          workId:r.work_id,workRevision:r.work_revision,attemptId:r.attempt_id,endpointId:r.endpoint_id,endpointRevision:r.endpoint_revision,
          grantId:r.grant_id,activationId:r.activation_id,runEpoch:r.admitted_run_epoch,workEpoch:r.admitted_work_epoch,
          requirementRevision:r.requirement_revision,planRevision:r.plan_revision,inputManifestId:r.input_manifest_id,roleSnapshotId:r.role_snapshot_id,
          originRole:'architect',targetRole:r.role,requestedOutputSchema:role.outputSchemaId})};
    });
  }
  function notSent(r:Row){
    const time=now();
    exec('INSERT INTO scheduled_dispatch_delivery(attempt_id,operation_id,outbox_id,state,endpoint_id,checked_at) VALUES(?,?,?,?,?,?)',r.attempt_id!,r.dispatch_operation_id!,r.outbox_id!,'NOT_SENT',r.endpoint_id!,time);
    exec("UPDATE outbox SET status='FAILED' WHERE outbox_id=?",r.outbox_id!);
    exec("UPDATE operations SET status='FAILED',result_json=?,updated_at=? WHERE operation_id=?",canonical({errorCode:'DISPATCH_NOT_SENT'}),time,r.dispatch_operation_id!);
    if(r.attempt_state==='RESERVED'){
      exec("UPDATE attempts SET state='FAILED',ended_at=? WHERE attempt_id=?",time,r.attempt_id!);
      exec('DELETE FROM role_slots WHERE attempt_id=?',r.attempt_id!);
      exec("UPDATE execution_grants SET status='REVOKED' WHERE attempt_id=?",r.attempt_id!);
      changed(String(r.run_id),String(r.dispatch_operation_id),String(r.work_id),String(r.attempt_id),'FAILED');
    }
    return {state:'NOT_SENT',taskId:null};
  }
  function mark(input:Parsed<'markScheduledDispatchSent'>){
    const r=row(input);
    if(r.delivery_state)return {send:false,state:String(r.delivery_state)};
    if(!sendable(r))return {send:false,state:notSent(r).state};
    const time=now();
    exec('INSERT INTO scheduled_dispatch_delivery(attempt_id,operation_id,outbox_id,state,endpoint_id,sent_at,checked_at) VALUES(?,?,?,?,?,?,?)',r.attempt_id!,r.dispatch_operation_id!,r.outbox_id!,'SENT',r.endpoint_id!,time,time);
    exec("UPDATE outbox SET status='RECONCILE',delivery_attempts=delivery_attempts+1 WHERE outbox_id=?",r.outbox_id!);
    return {send:true,state:'SENT'};
  }
  function reconcile(input:Parsed<'reconcileScheduledDispatch'>){
    const r=row(input),time=now();
    if(r.delivery_state===null)return sendable(r)?{state:'PENDING',taskId:null}:notSent(r);
    if(r.delivery_state==='NOT_SENT')return {state:'NOT_SENT',taskId:null};
    const task=get(`SELECT i.task_id FROM delegation_inbox i JOIN a2a_tasks t ON t.endpoint_id=i.endpoint_id AND t.task_id=i.task_id
      WHERE i.caller_id=? AND i.operation_id=? AND i.endpoint_id=? AND t.attempt_id=?`,r.caller_id!,r.dispatch_operation_id!,r.endpoint_id!,r.attempt_id!);
    if(task){
      exec("UPDATE scheduled_dispatch_delivery SET state='ACKED',task_id=?,checked_at=? WHERE attempt_id=?",task.task_id!,time,r.attempt_id!);
      exec("UPDATE outbox SET status='ACKED' WHERE outbox_id=?",r.outbox_id!);
      exec("UPDATE operations SET status='SUCCEEDED',result_json=?,updated_at=? WHERE operation_id=?",canonical({taskId:task.task_id}),time,r.dispatch_operation_id!);
      return {state:'ACKED',taskId:String(task.task_id)};
    }
    exec("UPDATE scheduled_dispatch_delivery SET state='RECONCILE',checked_at=? WHERE attempt_id=?",time,r.attempt_id!);
    exec("UPDATE operations SET status='OUTCOME_UNKNOWN',updated_at=? WHERE operation_id=?",time,r.dispatch_operation_id!);
    if(r.attempt_state==='RESERVED'){
      exec("UPDATE attempts SET state='OUTCOME_UNKNOWN' WHERE attempt_id=?",r.attempt_id!);
      changed(String(r.run_id),String(r.dispatch_operation_id),String(r.work_id),String(r.attempt_id),'OUTCOME_UNKNOWN');
    }
    return {state:'RECONCILE',taskId:null};
  }
  return {list,mark,reconcile};
}
