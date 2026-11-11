import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertPermit,executionPermit,parseContract} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import {StorageError} from './errors.js';

type Row=Record<string,string|number|null>;
function fail():never{throw new StorageError('MCP_AUTHORITY_DENIED',403,'Current tool authority is unavailable');}
const cleanup=new Set(['tests.get','tests.stop','tests.by-operation','issues.get','issues.by-operation','pipeline.get','pipeline.logs','pipeline.artifacts','pipeline.stop','pipeline.by-operation','repo.by-operation','repo.fileByOperation']);
export function createToolAuthorityDomain(db:DatabaseSync){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
  function check(permit:ExecutionPermit,toolName:string,action:'read'|'write'|'stop'){
    if(permit.ownerKind!=='workflowAttempt')fail();
    const h=get(`SELECT a.*,r.project_id,r.run_epoch,r.control_gate,r.terminal_outcome,w.work_epoch,w.blocked_reason,
      g.status AS grant_status,g.permit_json,p.owner_id,m.role AS membership FROM attempts a JOIN runs r ON r.run_id=a.run_id
      JOIN works w ON w.run_id=a.run_id AND w.work_id=a.work_id JOIN projects p ON p.project_id=r.project_id
      JOIN project_members m ON m.project_id=p.project_id AND m.principal_id=p.owner_id
      JOIN execution_grants g ON g.attempt_id=a.attempt_id AND g.activation_id=? AND g.grant_id=? WHERE a.attempt_id=? AND a.run_id=?`,
      permit.activationId,permit.grantId,permit.attemptId,permit.runId);
    if(!h||h.membership==='viewer')fail();
    const current=parseContract(executionPermit,JSON.parse(String(h.permit_json)));
    if(current.ownerKind!=='workflowAttempt')fail();
    if(['runId','runEpoch','workId','workEpoch','attemptId','activationId','grantId'].some(k=>(permit as unknown as Row)[k]!==(current as unknown as Row)[k]))fail();
    if(permit.resources.some(r=>!current.resources.some(c=>c.kind===r.kind&&c.resourceId===r.resourceId&&(c.access==='write'||r.access==='read'))))fail();
    const role=JSON.parse(String(h.role_snapshot_json)) as {allowedTools:string[]};
    const modelName=toolName.replaceAll('.','_'),isCleanup=cleanup.has(toolName)&&action!=='write';
    if(!role.allowedTools.includes(modelName)&&!role.allowedTools.includes(toolName)&&
      !(isCleanup&&role.allowedTools.some(t=>t.startsWith(toolName.split('.')[0]+'_')||t.startsWith(toolName.split('.')[0]+'.'))))fail();
    if(!isCleanup){
      if(h.grant_status!=='ACTIVE'||h.control_gate!=='OPEN'||h.terminal_outcome!==null||h.ended_at!==null||h.blocked_reason!==null||
        h.run_epoch!==permit.runEpoch||h.work_epoch!==permit.workEpoch)fail();
      for(const resource of permit.resources)assertPermit(permit,current,resource,Date.now());
      if(!get(`SELECT 1 FROM accepted_work w JOIN a2a_tasks t ON t.endpoint_id=w.endpoint_id AND t.task_id=w.task_id
        JOIN a2a_task_ownership o ON o.endpoint_id=t.endpoint_id AND o.task_id=t.task_id
        WHERE t.attempt_id=? AND w.activation_id=? AND w.state='ACTIVE' AND o.cancel_requested=0`,permit.attemptId,permit.activationId))fail();
    }
    return {principalId:String(h.owner_id),projectId:String(h.project_id),runId:permit.runId,host:h};
  }
  function refresh(original:ExecutionPermit,toolName:string,action:'read'|'write'|'stop'){
    const g=get('SELECT permit_json FROM execution_grants WHERE grant_id=?',original.grantId);if(!g)fail();
    const current=parseContract(executionPermit,JSON.parse(String(g.permit_json)));
    if(original.ownerKind!=='workflowAttempt'||current.ownerKind!=='workflowAttempt'||['runId','runEpoch','workId','workEpoch','attemptId','activationId','grantId'].some(k=>(original as unknown as Row)[k]!==(current as unknown as Row)[k]))fail();
    const permit=parseContract(executionPermit,{...current,resources:original.resources});check(permit,toolName,action);return permit;
  }
  return {check,refresh};
}
