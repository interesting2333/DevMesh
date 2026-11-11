import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {executionPermit,parseContract,pipelineDefinition} from '@devmesh/contracts';
import type {ExecutionPermit} from '@devmesh/contracts';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {pipelineRequests} from './pipeline-protocol.js';
import type {PipelineInput,PipelineMethod,PipelineView,PipelineDispatch} from './pipeline-protocol.js';
import {createToolAuthorityDomain} from './tool-authority-domain.js';

type Row=Record<string,string|number|null>;
const uid=(kind:string)=>kind+'_'+randomUUID().replaceAll('-',''),now=()=>new Date().toISOString();
function fail(code:string,status=409):never{throw new StorageError(code,status,'Pipeline action could not be applied');}
export function createPipelineDomain(db:DatabaseSync,changed:(runId:string,operationId:string,attemptId:string,payload:Record<string,unknown>)=>void){
  const get=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).get(...p) as Row|undefined;
  const all=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).all(...p) as Row[];
  const exec=(sql:string,...p:SQLInputValue[])=>db.prepare(sql).run(...p);
  const authority=createToolAuthorityDomain(db);
  const pipeline=(id:string)=>get('SELECT * FROM pipelines WHERE pipeline_id=?',id)??fail('PIPELINE_NOT_FOUND',404);
  const stage=(id:string,n:number)=>get('SELECT * FROM pipeline_stages WHERE pipeline_id=? AND ordinal=?',id,n)??fail('PIPELINE_STAGE_NOT_FOUND',404);
  function view(p:Row):PipelineView{
    return {pipelineId:String(p.pipeline_id),operationId:String(p.operation_id),runId:String(p.run_id),attemptId:String(p.attempt_id),definitionId:String(p.definition_id),definitionVersion:String(p.definition_version),definitionHash:String(p.definition_hash),workspaceRef:String(p.workspace_ref),state:String(p.state),stopRequested:p.stop_requested===1,
      stages:all('SELECT * FROM pipeline_stages WHERE pipeline_id=? ORDER BY ordinal',p.pipeline_id!).map(s=>{
        const job=s.job_json?JSON.parse(String(s.job_json)) as PipelineInput<'recordPipelineStage'>['job']:null;
        return {ordinal:Number(s.ordinal),stageId:String(s.stage_id),operationId:String(s.operation_id),state:String(s.state),jobId:s.job_id as string|null,
          exitCode:job?.exitCode??null,errorCode:s.error_code as string|null,logCursor:job?.logCursor??0,outputRefs:job?.outputRefs??[]};
      })};
  }
  function owned(p:Row,permit:ExecutionPermit,toolName:string,action:'read'|'write'|'stop'){
    authority.check(permit,toolName,action);
    if(permit.ownerKind!=='workflowAttempt'||p.run_id!==permit.runId||p.attempt_id!==permit.attemptId||p.activation_id!==permit.activationId||p.grant_id!==permit.grantId)fail('PIPELINE_NOT_FOUND',404);
    return p;
  }
  function notify(p:Row){changed(String(p.run_id),String(p.operation_id),String(p.attempt_id),{pipelineId:p.pipeline_id,toolOperationId:p.operation_id,state:p.state});}
  function refresh(p:Row){
    const stages=all('SELECT * FROM pipeline_stages WHERE pipeline_id=? ORDER BY ordinal',p.pipeline_id!);
    const failure=stages.some(s=>s.state==='EXITED'&&(()=>{const j=JSON.parse(String(s.job_json)) as PipelineInput<'recordPipelineStage'>['job'];return j.exitCode!==0||j.errorCode!==null||j.stopRequested;})());
    if(failure||p.stop_requested===1)exec("UPDATE pipeline_stages SET state='SKIPPED',checked_at=? WHERE pipeline_id=? AND state='PENDING'",now(),p.pipeline_id!);
    const pending=stages.some(s=>['SENT','ACKED','UNKNOWN'].includes(String(s.state))),unknown=stages.some(s=>s.state==='UNKNOWN');
    const state=unknown?'OUTCOME_UNKNOWN':p.stop_requested===1?(pending?'STOPPING':'CANCELLED'):failure?'FAILED':stages.every(s=>s.state==='EXITED')?'SUCCEEDED':stages.some(s=>s.state!=='PENDING')?'RUNNING':'QUEUED';
    if(state!==p.state){exec('UPDATE pipelines SET state=?,updated_at=? WHERE pipeline_id=?',state,now(),p.pipeline_id!);notify(pipeline(String(p.pipeline_id)));}
    return pipeline(String(p.pipeline_id));
  }
  function livePermit(p:Row){
    const original=parseContract(executionPermit,JSON.parse(String(p.permit_json))),grant=get('SELECT permit_json FROM execution_grants WHERE grant_id=?',p.grant_id!);
    if(!grant)fail('MCP_AUTHORITY_DENIED',403);
    const current=parseContract(executionPermit,JSON.parse(String(grant.permit_json)));
    if(original.ownerKind!=='workflowAttempt'||current.ownerKind!=='workflowAttempt'||original.runEpoch!==current.runEpoch||original.workEpoch!==current.workEpoch)fail('MCP_AUTHORITY_DENIED',403);
    const permit=parseContract(executionPermit,{...current,notBefore:new Date(Math.max(Date.parse(current.notBefore),Date.parse(current.expiresAt)-15000)).toISOString(),resources:original.resources});
    owned(p,permit,'pipeline.start','write');return permit;
  }
  const handlers={
    createPipeline(input:PipelineInput<'createPipeline'>){return transaction(db,()=>{
      const prior=get('SELECT * FROM pipelines WHERE operation_id=?',input.operationId),requestHash=digest(canonical({definition:input.definition,workspaceRef:input.workspaceRef}));
      if(prior){owned(prior,input.permit,'pipeline.by-operation','read');if(prior.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED');return view(prior);}
      const h=authority.check(input.permit,'pipeline.start','write'),p=input.permit;
      if(p.ownerKind!=='workflowAttempt'||!p.resources.some(r=>r.kind==='workspace'&&r.resourceId===input.workspaceRef&&r.access==='write'))fail('MCP_AUTHORITY_DENIED',403);
      const id=uid('pipeline'),time=now(),definition=input.definition;
      exec("INSERT INTO pipelines VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'QUEUED',0,?,?)",id,input.operationId,h.runId,p.attemptId,p.activationId,p.grantId,canonical(p),definition.definitionId,definition.version,digest(canonical(definition)),canonical(definition),input.workspaceRef,requestHash,time,time);
      for(const [n,s] of definition.stages.entries())exec("INSERT INTO pipeline_stages VALUES(?,?,?,?,'PENDING',NULL,NULL,NULL,NULL,?)",id,n,s.stageId,uid('op'),time);
      const created=pipeline(id);notify(created);return view(created);
    });},
    getPipeline(input:PipelineInput<'getPipeline'>){return transaction(db,()=>view(owned(pipeline(input.pipelineId),input.permit,'pipeline.get','read')));},
    getPipelineOperation(input:PipelineInput<'getPipelineOperation'>){return transaction(db,()=>{const p=get('SELECT * FROM pipelines WHERE operation_id=?',input.operationId);if(!p)fail('PIPELINE_OPERATION_NOT_FOUND',404);return view(owned(p,input.permit,'pipeline.by-operation','read'));});},
    stopPipeline(input:PipelineInput<'stopPipeline'>){return transaction(db,()=>{const p=owned(pipeline(input.pipelineId),input.permit,'pipeline.stop','stop');
      if(['SUCCEEDED','FAILED','CANCELLED'].includes(String(p.state)))return view(p);
      exec('UPDATE pipelines SET stop_requested=1,updated_at=? WHERE pipeline_id=?',now(),input.pipelineId);return view(refresh(pipeline(input.pipelineId)));
    });},
    listPipelineStages(input:PipelineInput<'listPipelineStages'>):PipelineDispatch[]{
      return all(`SELECT s.*,p.stop_requested FROM pipeline_stages s JOIN pipelines p ON p.pipeline_id=s.pipeline_id
        WHERE s.state IN ('PENDING','SENT','ACKED','UNKNOWN') AND p.state NOT IN ('SUCCEEDED','FAILED','CANCELLED')
        AND NOT EXISTS(SELECT 1 FROM pipeline_stages prior WHERE prior.pipeline_id=s.pipeline_id AND prior.ordinal<s.ordinal AND prior.state<>'EXITED')
        ORDER BY s.checked_at,s.pipeline_id,s.ordinal LIMIT ?`,input.limit).map(s=>({pipelineId:String(s.pipeline_id),ordinal:Number(s.ordinal),operationId:String(s.operation_id),state:String(s.state),jobId:s.job_id as string|null,stopRequested:s.stop_requested===1,request:s.request_json?JSON.parse(String(s.request_json)) as Record<string,unknown>:null}));
    },
    markPipelineStageSent(input:PipelineInput<'markPipelineStageSent'>){return transaction(db,()=>{
      const p=pipeline(input.pipelineId),s=stage(input.pipelineId,input.ordinal);
      if(s.state!=='PENDING')return {send:false,request:s.request_json?JSON.parse(String(s.request_json)) as Record<string,unknown>:null};
      if(p.stop_requested===1||['SUCCEEDED','FAILED','CANCELLED','OUTCOME_UNKNOWN'].includes(String(p.state)))fail('PIPELINE_ADMISSION_CLOSED');
      const previous=all('SELECT * FROM pipeline_stages WHERE pipeline_id=? AND ordinal<?',input.pipelineId,input.ordinal);
      if(previous.some(v=>v.state!=='EXITED'||(()=>{const j=JSON.parse(String(v.job_json)) as PipelineInput<'recordPipelineStage'>['job'];return j.exitCode!==0||j.errorCode!==null||j.stopRequested;})()))fail('PIPELINE_DEPENDENCY_UNSATISFIED');
      const definition=parseContract(pipelineDefinition,JSON.parse(String(p.definition_json))),spec=definition.stages[input.ordinal];if(!spec)fail('PIPELINE_STAGE_NOT_FOUND',404);
      const request={schemaVersion:'devmesh.runner-job.v1',operationId:s.operation_id,permit:livePermit(p),imageDigest:spec.imageDigest,workspaceRef:p.workspace_ref,
        commandSpec:{kind:spec.kind},resourceLimits:spec.resourceLimits,networkPolicyRef:spec.networkPolicyRef,outputSpec:spec.outputSpec};
      exec("UPDATE pipeline_stages SET state='SENT',request_json=?,checked_at=? WHERE pipeline_id=? AND ordinal=?",canonical(request),now(),input.pipelineId,input.ordinal);
      refresh(p);return {send:true,request};
    });},
    getPipelineStagePermit(input:PipelineInput<'getPipelineStagePermit'>){return transaction(db,()=>{const p=pipeline(input.pipelineId),s=stage(input.pipelineId,input.ordinal);if(p.stop_requested===1||!['SENT','ACKED','UNKNOWN'].includes(String(s.state)))fail('PIPELINE_ADMISSION_CLOSED');return livePermit(p);});},
    recordPipelineStage(input:PipelineInput<'recordPipelineStage'>){return transaction(db,()=>{
      const p=pipeline(input.pipelineId),s=stage(input.pipelineId,input.ordinal),j=input.job;
      if(!s.request_json||s.operation_id!==j.operationId||digest(String(s.request_json))!==j.requestHash||canonical(j.request)!==s.request_json||s.job_id!==null&&s.job_id!==j.jobId)fail('PIPELINE_JOB_BASIS_CHANGED');
      if(s.state==='EXITED'){if(s.job_json!==canonical(j))fail('PIPELINE_STAGE_RESULT_IMMUTABLE');return view(p);}
      const neverDispatched=j.stopRequested&&j.containerId===null&&j.startedAt===null&&j.stopEvidence?.neverDispatched===true&&typeof j.stopEvidence.verifiedAt==='string'&&Number.isFinite(Date.parse(j.stopEvidence.verifiedAt))&&j.logCursor===0&&j.outputRefs.length===0;
      if(j.state==='EXITED'&&j.exitCode===null&&!neverDispatched)fail('PIPELINE_EXIT_UNPROVEN');
      const state=j.state==='EXITED'?'EXITED':j.state==='OUTCOME_UNKNOWN'?'UNKNOWN':'ACKED';
      exec('UPDATE pipeline_stages SET state=?,job_id=?,job_json=?,error_code=?,checked_at=? WHERE pipeline_id=? AND ordinal=?',state,j.jobId,canonical(j),j.errorCode,now(),input.pipelineId,input.ordinal);
      const updated=refresh(p);if(updated.state===p.state&&s.job_json!==canonical(j))notify(updated);return view(updated);
    });},
    markPipelineStageUnknown(input:PipelineInput<'markPipelineStageUnknown'>){return transaction(db,()=>{
      const p=pipeline(input.pipelineId),s=stage(input.pipelineId,input.ordinal);
      if(['SENT','ACKED','UNKNOWN'].includes(String(s.state)))exec("UPDATE pipeline_stages SET state='UNKNOWN',error_code=?,checked_at=? WHERE pipeline_id=? AND ordinal=?",input.errorCode,now(),input.pipelineId,input.ordinal);
      else if(s.state==='PENDING')exec('UPDATE pipeline_stages SET error_code=?,checked_at=? WHERE pipeline_id=? AND ordinal=?',input.errorCode,now(),input.pipelineId,input.ordinal);
      return view(refresh(p));
    });},
  };
  return {execute(method:PipelineMethod,input:unknown){const p=parseContract(pipelineRequests[method],input);return (handlers[method] as (p:unknown)=>unknown)(p);}};
}
