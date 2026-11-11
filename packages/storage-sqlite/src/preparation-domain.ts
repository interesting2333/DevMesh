import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {parseContract,preparationDelegation,preparationProfile,architectOutput} from '@devmesh/contracts';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {preparationRequests} from './preparation-protocol.js';
import type {PreparationMethod,PreparationParsed,PreparationAttempt,PreparationTask,PreparationHost,PreparationJob} from './preparation-protocol.js';
import {StorageError} from './errors.js';
import {createUnderstandingDomain,preparationId as uid,preparationFail as fail} from './understanding-domain.js';
import type {PreparationHelpers,PreparationRow as Row} from './understanding-domain.js';
const now=()=>new Date().toISOString();
const terminal=new Set(['completed','failed','canceled','rejected']);

export function createPreparationDomain(db:DatabaseSync,h:PreparationHelpers){
  const understanding=createUnderstandingDomain(db,h);
  const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as Row|undefined;
  const all=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as Row[];
  const exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
  const required=(r:Row|undefined)=>r??fail('RESOURCE_NOT_FOUND',404,'Preparation record is not visible');
  const object=(value:unknown)=>JSON.parse(String(value)) as Record<string,unknown>;
  function authority(a:Row,grant=false){
    const job=understanding.job(String(a.job_id)),run=understanding.authorize(String(job.principal_id),String(a.run_id),true);
    if(run.terminal_outcome!==null||run.control_gate!=='OPEN'||run.run_epoch!==a.run_epoch||a.ended_at!==null)fail('PREPARATION_ADMISSION_CLOSED',409,'Preparation authority is no longer active');
    understanding.assertPreparationPhase(run);
    understanding.sameBasis(job);
    if(grant&&(String(a.grant_not_before)>now()||String(a.grant_expires_at)<=now()))fail('PERMIT_EXPIRED',403,'Preparation admission grant expired');
    return {run,job};
  }
  function attemptView(a:Row):PreparationAttempt{
    const job=understanding.job(String(a.job_id));
    const delegation=parseContract(preparationDelegation,{schemaVersion:'devmesh.preparation.v1',operationId:job.operation_id,jobId:a.job_id,preparationAttemptId:a.preparation_attempt_id,runId:a.run_id,runEpoch:a.run_epoch,activationId:a.activation_id,grantId:a.grant_id,endpointId:a.endpoint_id,endpointRevision:a.endpoint_revision,role:a.role,inputHash:a.input_hash,profileHash:a.profile_hash,basisHash:a.basis_hash});
    return {preparationAttemptId:String(a.preparation_attempt_id),jobId:String(a.job_id),runId:String(a.run_id),state:String(a.state),delegation,endpointId:String(a.endpoint_id),endpointRevision:Number(a.endpoint_revision),callerId:String(a.caller_id),dispatchSent:a.dispatch_sent_at!==null};
  }
  const attempt=(id:string)=>required(get('SELECT * FROM preparation_attempts WHERE preparation_attempt_id=?',id));
  function taskView(row:Row):PreparationTask{return {endpointId:String(row.endpoint_id),taskId:String(row.task_id),contextId:String(row.context_id),state:String(row.protocol_state),revision:Number(row.status_revision),snapshot:object(row.snapshot_json)};}
  function task(callerId:string,endpointId:string,taskId:string){
    const row=required(get('SELECT * FROM preparation_a2a_tasks WHERE caller_id=? AND endpoint_id=? AND task_id=?',callerId,endpointId,taskId)),a=attempt(String(row.preparation_attempt_id));
    // Querying history remains allowed after pause or grant expiry, but never
    // bypasses current ownership, project membership or endpoint caller policy.
    understanding.authorize(String(understanding.job(String(a.job_id)).principal_id),String(a.run_id));
    const config=object(required(get('SELECT config_json FROM endpoint_registrations WHERE endpoint_id=? AND revision=?',endpointId,row.endpoint_revision!)).config_json);
    if(!(config.allowedCallers as string[]).includes(callerId))fail('FORBIDDEN',403,'Service caller is no longer allowed');return row;
  }
  function updateTask(row:Row,state:string,metadata:Record<string,unknown>={}){
    const snapshot=object(row.snapshot_json),revision=Number(row.status_revision)+1,time=now();
    const next={...snapshot,status:{state:'TASK_STATE_'+state.toUpperCase().replaceAll('-','_'),timestamp:time},metadata:{...(snapshot.metadata as object),...metadata,cancelRequested:row.cancel_requested===1}};
    exec('UPDATE preparation_a2a_tasks SET protocol_state=?,status_revision=?,snapshot_json=?,updated_at=? WHERE task_id=?',state,revision,canonical(next),time,row.task_id!);
    exec('INSERT INTO preparation_task_events VALUES(?,?,?,?)',row.task_id!,revision,canonical(next),time);
    return taskView(required(get('SELECT * FROM preparation_a2a_tasks WHERE task_id=?',row.task_id!)));
  }
  function claim(input:{preparationAttemptId:string;workerId:string;claimToken:string},active=true){
    const a=attempt(input.preparationAttemptId),t=required(get('SELECT * FROM preparation_a2a_tasks WHERE preparation_attempt_id=?',input.preparationAttemptId));
    if(t.worker_id!==input.workerId||t.claim_token!==input.claimToken||terminal.has(String(t.protocol_state))||active&&a.ended_at!==null)fail('PREPARATION_CLAIM_CHANGED',409,'Preparation consumer claim changed');return {a,t};
  }
  function settle(a:Row,t:Row,state:'SUCCEEDED'|'FAILED'|'SUPERSEDED'|'CANCELLED',reason:string|null=null){
    exec('UPDATE preparation_attempts SET state=?,ended_at=? WHERE preparation_attempt_id=?',state,now(),a.preparation_attempt_id!);
    exec('DELETE FROM preparation_slots WHERE preparation_attempt_id=?',a.preparation_attempt_id!);
    const job=understanding.job(String(a.job_id));
    exec('UPDATE preparation_jobs SET state=?,error_code=?,updated_at=? WHERE job_id=?',state==='SUCCEEDED'?'APPLIED':state==='CANCELLED'?'FAILED':state,reason,now(),a.job_id!);
    exec('UPDATE operations SET status=?,result_json=?,updated_at=? WHERE operation_id=?',state==='SUCCEEDED'?'SUCCEEDED':'FAILED',canonical({jobId:a.job_id,...(reason?{errorCode:reason}:{})}),now(),job.operation_id!);
    return updateTask(t,state==='SUCCEEDED'?'completed':state==='CANCELLED'?'canceled':'failed',reason?{errorCode:reason}:{});
  }
  function releaseUnsent(a:Row){
    const time=now();
    exec("UPDATE preparation_attempts SET state='FAILED',ended_at=? WHERE preparation_attempt_id=? AND dispatch_sent_at IS NULL",time,a.preparation_attempt_id!);
    exec('DELETE FROM preparation_slots WHERE preparation_attempt_id=?',a.preparation_attempt_id!);
    exec("UPDATE preparation_jobs SET state='WAITING',updated_at=? WHERE job_id=?",time,a.job_id!);
  }
  function closeUnreservedJob(job:Row,code:string){
    const state=['BASIS_SUPERSEDED','PREPARATION_ADMISSION_CLOSED'].includes(code)?'SUPERSEDED':'FAILED',time=now();
    exec('UPDATE preparation_jobs SET state=?,error_code=?,updated_at=? WHERE job_id=?',state,code,time,job.job_id!);
    exec("UPDATE operations SET status='FAILED',result_json=?,updated_at=? WHERE operation_id=?",canonical({jobId:job.job_id,errorCode:code}),time,job.operation_id!);
  }
  function registry(endpointId:string,endpointRevision:number,generationId:string,projectionRevision:number,callerId:string,role:string){
    required(get('SELECT * FROM registry_control WHERE active_generation_id=? AND projection_revision=?',generationId,projectionRevision));
    required(get('SELECT * FROM role_endpoint_bindings WHERE generation_id=? AND role=? AND endpoint_id=? AND endpoint_revision=?',generationId,role,endpointId,endpointRevision));
    const endpoint=required(get("SELECT e.config_json FROM endpoint_registrations e JOIN endpoint_runtime_state s ON s.endpoint_id=e.endpoint_id AND s.revision=e.revision JOIN endpoint_checks c ON c.check_id=s.latest_check_id WHERE e.endpoint_id=? AND e.revision=? AND s.lifecycle='ACTIVE' AND c.status='HEALTHY' AND c.expires_at>?",endpointId,endpointRevision,now())),config=object(endpoint.config_json);
    if(config.enabled!==true||!(config.allowedCallers as string[]).includes(callerId)||config.role!==role||!(config.supportedSkills as string[]).includes('devmesh.prepare.'+role))fail('FORBIDDEN',403,'Preparation skill or service caller is not allowed');
    return config;
  }
  const handlers={
    ...understanding.handlers,
    listPreparationJobs(input:PreparationParsed<'listPreparationJobs'>){
      const pending=all("SELECT x.operation_id,m.run_id,o.principal_id FROM input_processing x JOIN operations o ON o.operation_id=x.operation_id JOIN input_messages m ON m.message_id=x.message_id JOIN runs r ON r.run_id=m.run_id JOIN project_members p ON p.project_id=r.project_id AND p.principal_id=o.principal_id AND p.role<>'viewer' WHERE o.status='WAITING' AND r.phase IN ('PREPARING','UNDERSTANDING','PLANNING') AND r.control_gate='OPEN' AND r.terminal_outcome IS NULL AND NOT EXISTS(SELECT 1 FROM plan_confirmations c WHERE c.run_id=r.run_id AND c.plan_revision=r.current_plan_revision) AND NOT EXISTS(SELECT 1 FROM preparation_jobs j WHERE j.operation_id=o.operation_id) ORDER BY m.rowid LIMIT ?",input.limit);
      for(const p of pending)understanding.handlers.ensurePreparationJob(parseContract(preparationRequests.ensurePreparationJob,{principalId:p.principal_id,runId:p.run_id,processingOperationId:p.operation_id}));
      return transaction(db,()=>{
        for(const a of all("SELECT * FROM preparation_attempts WHERE state='RESERVED' AND dispatch_sent_at IS NULL AND grant_expires_at<=?",now()))releaseUnsent(a);
        const candidates=all(`SELECT j.* FROM preparation_jobs j JOIN runs r ON r.run_id=j.run_id
          JOIN project_members m ON m.project_id=r.project_id AND m.principal_id=j.principal_id AND m.role<>'viewer'
          WHERE j.state IN ('WAITING','READY') AND r.control_gate='OPEN' AND r.terminal_outcome IS NULL
          AND NOT EXISTS(SELECT 1 FROM preparation_attempts a WHERE a.run_id=j.run_id AND a.role=j.role AND a.dispatch_sent_at IS NOT NULL AND a.ended_at IS NULL)
          ORDER BY j.created_at,j.rowid LIMIT ?`,input.limit);
        const jobs:PreparationJob[]=[];
        for(const j of candidates){
          try{
            understanding.assertPreparationPhase(understanding.authorize(String(j.principal_id),String(j.run_id),true));
            if(j.basis_hash!==null)understanding.sameBasis(j);
            jobs.push(understanding.jobView(j));
          }catch(error){
            if(!(error instanceof StorageError)||!['BASIS_SUPERSEDED','PREPARATION_ADMISSION_CLOSED','PREPARATION_INPUT_LIMIT','CONTENT_UNAVAILABLE'].includes(error.code))throw error;
            const a=get("SELECT * FROM preparation_attempts WHERE job_id=? AND ended_at IS NULL AND dispatch_sent_at IS NULL",j.job_id!);
            if(a)releaseUnsent(a);
            closeUnreservedJob(j,error.code);
          }
        }
        return jobs;
      });
    },
    failUnreservedPreparation(input:PreparationParsed<'failUnreservedPreparation'>){return transaction(db,()=>{
      const job=understanding.job(input.jobId);
      if(job.principal_id!==input.principalId||job.state!=='WAITING'||get('SELECT 1 FROM preparation_attempts WHERE job_id=? AND ended_at IS NULL',input.jobId))return {closed:false};
      closeUnreservedJob(job,input.errorCode);return {closed:true};
    });},
    reservePreparation(input:PreparationParsed<'reservePreparation'>){return transaction(db,()=>{
      const job=understanding.job(input.jobId),run=understanding.authorize(input.principalId,String(job.run_id),true);
      if(job.principal_id!==input.principalId||run.terminal_outcome!==null||run.control_gate!=='OPEN')fail('PREPARATION_ADMISSION_CLOSED',409,'Run does not admit preparation');
      understanding.assertPreparationPhase(run);
      const previous=get('SELECT * FROM preparation_attempts WHERE job_id=? AND ended_at IS NULL',input.jobId);
      if(previous){
        if(previous.input_hash!==input.inputHash||previous.profile_hash!==input.profileHash||previous.endpoint_id!==input.endpointId||previous.endpoint_revision!==input.endpointRevision||previous.basis_hash!==input.basisHash||previous.caller_id!==input.callerId)fail('PREPARATION_RESERVATION_CHANGED',409,'An original reservation has a different immutable payload');
        return attemptView(previous);
      }
      if(!['WAITING','READY'].includes(String(job.state)))fail('PREPARATION_NOT_WAITING',409,'Preparation is not waiting for a new attempt');
      const context=job.basis_hash===null?understanding.freezeBasis(job):understanding.sameBasis(job);
      if(context.basisHash!==input.basisHash)fail('BASIS_SUPERSEDED',409,'Preparation input changed before reservation');
      registry(input.endpointId,input.endpointRevision,input.registryGenerationId,input.projectionRevision,input.callerId,String(job.role));
      if(digest(canonical(input.profile))!==input.profileHash)fail('PREPARATION_PROFILE_INVALID',422,'Profile does not match its persisted hash');
      understanding.ready(input.profileHash);understanding.ready(input.inputHash);understanding.ready(input.profile.promptHash);
      if(run.preparation_token_limit===null)exec('UPDATE runs SET preparation_token_limit=? WHERE run_id=?',input.profile.tokenLimit,job.run_id!);
      else if(run.preparation_token_limit!==input.profile.tokenLimit)fail('PREPARATION_BUDGET_CHANGED',409,'Change preparation limits through an explicit configuration revision');
      if(Number(run.preparation_tokens_used)>=input.profile.tokenLimit)fail('PREPARATION_BUDGET_EXHAUSTED',409,'Preparation token budget is exhausted');
      const attemptNo=Number(get('SELECT max(attempt_no) AS n FROM preparation_attempts WHERE job_id=?',input.jobId)?.n??0)+1;
      if(Number(get('SELECT count(*) AS n FROM preparation_attempts WHERE run_id=?',job.run_id!)?.n)>=200)fail('PREPARATION_BUDGET_EXHAUSTED',409,'Preparation attempt limit reached');
      const id=uid('pattempt'),time=now();
      exec("INSERT INTO preparation_attempts(preparation_attempt_id,run_id,job_id,attempt_no,run_epoch,role,activation_id,grant_id,grant_not_before,grant_expires_at,endpoint_id,endpoint_revision,registry_generation_id,caller_id,profile_hash,profile_json,input_hash,basis_hash,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'RESERVED',?)",id,job.run_id!,input.jobId,attemptNo,run.run_epoch!,job.role!,uid('activation'),uid('grant'),time,new Date(Date.parse(time)+15000).toISOString(),input.endpointId,input.endpointRevision,input.registryGenerationId,input.callerId,input.profileHash,canonical(input.profile),input.inputHash,input.basisHash,time);
      exec('INSERT INTO preparation_slots VALUES(?,?,?)',job.run_id!,job.role!,id);
      exec("UPDATE preparation_jobs SET state='READY',updated_at=? WHERE job_id=?",time,input.jobId);
      const result=attemptView(attempt(id));h.outbox(String(job.operation_id),'preparation.a2a',result.delegation);return result;
    });},
    markPreparationDispatchSent(input:PreparationParsed<'markPreparationDispatchSent'>){return transaction(db,()=>{
      const a=attempt(input.preparationAttemptId);authority(a,true);
      if(a.state!=='RESERVED'||a.dispatch_sent_at!==null)fail('PREPARATION_NOT_SENDABLE',409,'Original delegation already has a send record');
      exec('UPDATE preparation_attempts SET dispatch_sent_at=? WHERE preparation_attempt_id=?',now(),input.preparationAttemptId);return attemptView(attempt(input.preparationAttemptId));
    });},
    lookupPreparationDispatch(input:PreparationParsed<'lookupPreparationDispatch'>){const t=get('SELECT * FROM preparation_a2a_tasks WHERE preparation_attempt_id=?',input.preparationAttemptId);return t?taskView(t):null;},
    reconcilePreparationDispatch(input:PreparationParsed<'reconcilePreparationDispatch'>){return transaction(db,()=>{
      const a=attempt(input.preparationAttemptId),t=get('SELECT * FROM preparation_a2a_tasks WHERE preparation_attempt_id=?',input.preparationAttemptId);if(t)return taskView(t);
      if(a.state==='RESERVED'&&a.dispatch_sent_at!==null){exec("UPDATE preparation_attempts SET state='RECONCILE' WHERE preparation_attempt_id=?",input.preparationAttemptId);exec("UPDATE preparation_jobs SET state='RECONCILE',error_code='PREPARATION_DISPATCH_UNKNOWN' WHERE job_id=?",a.job_id!);exec("UPDATE operations SET status='OUTCOME_UNKNOWN',updated_at=? WHERE operation_id=(SELECT operation_id FROM preparation_jobs WHERE job_id=?)",now(),a.job_id!);}return null;
    });},
    acceptPreparationTask(input:PreparationParsed<'acceptPreparationTask'>){return transaction(db,()=>{
      const d=input.delegation,a=attempt(d.preparationAttemptId),job=understanding.job(String(a.job_id));
      understanding.authorize(String(job.principal_id),String(a.run_id),true);
      const requestHash=digest(canonical({delegation:d,message:input.message})),old=get('SELECT * FROM preparation_inbox WHERE caller_id=? AND endpoint_id=? AND operation_id=?',input.callerId,input.endpointId,d.operationId);
      if(old){if(old.request_hash!==requestHash)fail('IDEMPOTENCY_KEY_REUSED',409,'Preparation key belongs to a different payload');return taskView(task(input.callerId,input.endpointId,String(old.task_id)));}
      authority(a,true);registry(input.endpointId,input.endpointRevision,input.registryGenerationId,input.projectionRevision,input.callerId,String(a.role));
      if(a.caller_id!==input.callerId||canonical(attemptView(a).delegation)!==canonical(d)||a.endpoint_id!==input.endpointId||a.endpoint_revision!==input.endpointRevision||a.registry_generation_id!==input.registryGenerationId||a.dispatch_sent_at===null||!['RESERVED','RECONCILE'].includes(String(a.state)))fail('PREPARATION_DELEGATION_INVALID',403,'Delegation differs from committed preparation authority');
      const id=uid('prepTask'),contextId=uid('prepContext'),time=now(),snapshot={id,contextId,status:{state:'TASK_STATE_SUBMITTED',timestamp:time},history:[input.message],artifacts:[],metadata:{ownerKind:'preparation',jobId:a.job_id,preparationAttemptId:a.preparation_attempt_id}};
      exec("INSERT INTO preparation_a2a_tasks(task_id,endpoint_id,endpoint_revision,preparation_attempt_id,caller_id,context_id,protocol_state,snapshot_json,created_at,updated_at) VALUES(?,?,?,?,?,?,'submitted',?,?,?)",id,input.endpointId,input.endpointRevision,d.preparationAttemptId,input.callerId,contextId,canonical(snapshot),time,time);
      exec('INSERT INTO preparation_inbox VALUES(?,?,?,?,?)',input.callerId,input.endpointId,d.operationId,requestHash,id);exec('INSERT INTO preparation_task_events VALUES(?,1,?,?)',id,canonical(snapshot),time);
      exec("UPDATE preparation_attempts SET state='SUBMITTED' WHERE preparation_attempt_id=?",d.preparationAttemptId);
      exec("UPDATE preparation_jobs SET state='ACTIVE',error_code=NULL,updated_at=? WHERE job_id=?",time,a.job_id!);
      exec("UPDATE operations SET status='RUNNING',updated_at=? WHERE operation_id=?",time,d.operationId);
      return taskView(task(input.callerId,input.endpointId,id));
    });},
    getPreparationTask(input:PreparationParsed<'getPreparationTask'>){return taskView(task(input.callerId,input.endpointId,input.taskId));},
    listPreparationTasks(input:PreparationParsed<'listPreparationTasks'>){
      const visibility=" FROM preparation_a2a_tasks t JOIN preparation_attempts a ON a.preparation_attempt_id=t.preparation_attempt_id JOIN preparation_jobs j ON j.job_id=a.job_id JOIN runs r ON r.run_id=a.run_id JOIN project_members m ON m.project_id=r.project_id AND m.principal_id=j.principal_id WHERE t.caller_id=? AND t.endpoint_id=?";
      const rows=all('SELECT t.*'+visibility+' AND t.task_id>? ORDER BY t.task_id LIMIT ?',input.callerId,input.endpointId,input.afterId??'',input.limit+1),page=rows.slice(0,input.limit).map(taskView);
      return {tasks:page,nextPageToken:rows.length>input.limit?page.at(-1)!.taskId:'',totalSize:Number(get('SELECT count(*) AS n'+visibility,input.callerId,input.endpointId)?.n??0)};
    },
    listPreparationTaskEvents(input:PreparationParsed<'listPreparationTaskEvents'>){task(input.callerId,input.endpointId,input.taskId);return all('SELECT * FROM preparation_task_events WHERE task_id=? AND seq>? ORDER BY seq LIMIT 200',input.taskId,input.afterSeq).map(r=>({seq:Number(r.seq),snapshot:object(r.snapshot_json)}));},
    cancelPreparationTask(input:PreparationParsed<'cancelPreparationTask'>){return transaction(db,()=>{
      const t=task(input.callerId,input.endpointId,input.taskId),a=attempt(String(t.preparation_attempt_id));if(t.protocol_state==='canceled')return taskView(t);if(terminal.has(String(t.protocol_state)))fail('TASK_NOT_CANCELABLE',409,'Preparation Task is already terminal');
      exec('UPDATE preparation_a2a_tasks SET cancel_requested=1 WHERE task_id=?',input.taskId);t.cancel_requested=1;
      const step=get('SELECT state FROM preparation_steps WHERE preparation_attempt_id=?',a.preparation_attempt_id!);
      if(!step||step.state==='PREPARED')return settle(a,t,'CANCELLED','PREPARATION_CANCELLED_BEFORE_SEND');
      return updateTask(t,String(t.protocol_state));
    });},
    claimPreparationTasks(input:PreparationParsed<'claimPreparationTasks'>){return transaction(db,()=>{
      const result=[];for(const t of all("SELECT t.* FROM preparation_a2a_tasks t JOIN preparation_attempts a ON a.preparation_attempt_id=t.preparation_attempt_id JOIN runs r ON r.run_id=a.run_id WHERE t.endpoint_id=? AND r.control_gate='OPEN' AND (t.protocol_state='submitted' OR a.state='RESPONDED' AND t.worker_id IS NULL) ORDER BY t.created_at,t.task_id LIMIT ?",input.endpointId,input.limit)){
        const a=attempt(String(t.preparation_attempt_id));
        try{authority(a);}catch(error){if(error instanceof Error&&'code' in error&&['BASIS_SUPERSEDED','PREPARATION_ADMISSION_CLOSED','RESOURCE_NOT_FOUND','FORBIDDEN'].includes(String(error.code))){settle(a,t,'SUPERSEDED',String(error.code));continue;}throw error;}
        if(t.cancel_requested===1){settle(a,t,'CANCELLED','PREPARATION_CANCELLED');continue;}
        const token=uid('claim');exec('UPDATE preparation_a2a_tasks SET worker_id=?,claim_token=? WHERE task_id=?',input.workerId,token,t.task_id!);
        if(a.state!=='RESPONDED')exec("UPDATE preparation_attempts SET state='WORKING' WHERE preparation_attempt_id=?",a.preparation_attempt_id!);
        exec("UPDATE preparation_jobs SET state='ACTIVE',updated_at=? WHERE job_id=?",now(),a.job_id!);exec("UPDATE operations SET status='RUNNING',updated_at=? WHERE operation_id=(SELECT operation_id FROM preparation_jobs WHERE job_id=?)",now(),a.job_id!);updateTask(t,'working');
        result.push({preparationAttemptId:String(a.preparation_attempt_id),workerId:input.workerId,claimToken:token});
      }return result;
    });},
    getPreparationHost(input:PreparationParsed<'getPreparationHost'>):PreparationHost{
      const {a}=claim(input),step=get('SELECT * FROM preparation_steps WHERE preparation_attempt_id=?',input.preparationAttemptId),job=understanding.job(String(a.job_id));
      return {claim:input,attempt:attemptView(a),job:understanding.jobView(job),principalId:String(job.principal_id),profile:object(a.profile_json),profileHash:String(a.profile_hash),inputHash:String(a.input_hash),requestHash:(step?.request_hash as string|undefined)??null,responseHash:(step?.response_hash as string|undefined)??null,stepState:(step?.state as string|undefined)??null};
    },
    preparePreparationStep(input:PreparationParsed<'preparePreparationStep'>){return transaction(db,()=>{
      const {a,t}=claim(input),{run}=authority(a);if(t.cancel_requested===1)fail('PREPARATION_ADMISSION_CLOSED',409,'Preparation cancellation was requested');
      const previous=get('SELECT * FROM preparation_steps WHERE preparation_attempt_id=?',input.preparationAttemptId);
      if(previous){if(previous.request_hash!==input.requestHash||previous.reserved_tokens!==input.reservedTokens)fail('PREPARATION_REQUEST_IMMUTABLE',409,'Model request is immutable');return {state:String(previous.state)};}
      understanding.ready(input.requestHash);const profile=parseContract(preparationProfile,object(a.profile_json));
      if(Number(run.preparation_tokens_used)+input.reservedTokens>profile.tokenLimit)fail('PREPARATION_BUDGET_EXHAUSTED',409,'Insufficient remaining preparation tokens');
      const time=now();exec("INSERT INTO preparation_steps(preparation_attempt_id,step_no,request_hash,state,reserved_tokens,created_at,updated_at) VALUES(?,1,?,'PREPARED',?,?,?)",input.preparationAttemptId,input.requestHash,input.reservedTokens,time,time);return {state:'PREPARED'};
    });},
    markPreparationSent(input:PreparationParsed<'markPreparationSent'>){return transaction(db,()=>{
      const {a,t}=claim(input),{run}=authority(a),step=required(get('SELECT * FROM preparation_steps WHERE preparation_attempt_id=?',input.preparationAttemptId));
      if(t.cancel_requested===1||step.state!=='PREPARED')fail('PREPARATION_NOT_SENDABLE',409,'Original model request is not available for first send');
      if(Number(run.preparation_tokens_used)+Number(step.reserved_tokens)>Number(run.preparation_token_limit))fail('PREPARATION_BUDGET_EXHAUSTED',409,'Preparation token budget exhausted');
      exec('UPDATE runs SET preparation_tokens_used=preparation_tokens_used+? WHERE run_id=?',step.reserved_tokens!,a.run_id!);exec("UPDATE preparation_steps SET state='SENT',updated_at=? WHERE preparation_attempt_id=?",now(),input.preparationAttemptId);return {state:'SENT'};
    });},
    savePreparationResponse(input:PreparationParsed<'savePreparationResponse'>){return transaction(db,()=>{
      const {a}=claim(input),step=required(get('SELECT * FROM preparation_steps WHERE preparation_attempt_id=?',input.preparationAttemptId));understanding.ready(input.responseHash);
      if(step.state==='RESPONDED'){if(step.response_hash!==input.responseHash)fail('PREPARATION_RESPONSE_IMMUTABLE',409,'Model response is immutable');return {state:'RESPONDED'};}
      if(!['SENT','RECONCILE'].includes(String(step.state)))fail('PREPARATION_NOT_SENT',409,'A response requires a recorded original send');
      exec("UPDATE preparation_steps SET state='RESPONDED',response_hash=?,provider_request_id=?,input_tokens=?,output_tokens=?,usage_source=?,updated_at=? WHERE preparation_attempt_id=?",input.responseHash,input.providerRequestId,input.usage.inputTokens,input.usage.outputTokens,input.usage.source,now(),input.preparationAttemptId);
      exec('UPDATE runs SET preparation_tokens_used=preparation_tokens_used-?+? WHERE run_id=?',step.reserved_tokens!,input.usage.inputTokens+input.usage.outputTokens,a.run_id!);
      exec("UPDATE preparation_attempts SET state='RESPONDED' WHERE preparation_attempt_id=?",input.preparationAttemptId);return {state:'RESPONDED'};
    });},
    failPreparation(input:PreparationParsed<'failPreparation'>){return transaction(db,()=>{
      const {a,t}=claim(input),step=get('SELECT * FROM preparation_steps WHERE preparation_attempt_id=?',input.preparationAttemptId);
      if(input.unknown||step?.state==='SENT'&&!input.knownFailure){
        exec("UPDATE preparation_attempts SET state='RECONCILE' WHERE preparation_attempt_id=?",input.preparationAttemptId);exec("UPDATE preparation_jobs SET state='RECONCILE',error_code=?,updated_at=? WHERE job_id=?",input.errorCode,now(),a.job_id!);exec("UPDATE operations SET status='OUTCOME_UNKNOWN',updated_at=? WHERE operation_id=(SELECT operation_id FROM preparation_jobs WHERE job_id=?)",now(),a.job_id!);if(step?.state==='SENT')exec("UPDATE preparation_steps SET state='RECONCILE',error_code=?,updated_at=? WHERE preparation_attempt_id=?",input.errorCode,now(),input.preparationAttemptId);return {state:'RECONCILE'};
      }
      if(step&&step.state!=='RESPONDED')exec("UPDATE preparation_steps SET state='FAILED',error_code=?,updated_at=? WHERE preparation_attempt_id=?",input.errorCode,now(),input.preparationAttemptId);
      const state=t.cancel_requested===1?'CANCELLED':['BASIS_SUPERSEDED','PREPARATION_ADMISSION_CLOSED'].includes(input.errorCode)?'SUPERSEDED':'FAILED';
      settle(a,t,state,input.errorCode);return {state};
    });},
    applyPreparationResponse(input:PreparationParsed<'applyPreparationResponse'>){return transaction(db,()=>{
      const {a,t}=claim(input),{job,run}=authority(a),step=required(get("SELECT * FROM preparation_steps WHERE preparation_attempt_id=? AND state='RESPONDED'",input.preparationAttemptId));
      if(t.cancel_requested===1)fail('PREPARATION_ADMISSION_CLOSED',409,'Preparation cancellation was requested');
      if(!step.response_hash||digest(canonical(input.output))!==input.outputHash)fail('PREPARATION_OUTPUT_INVALID',422,'Structured output hash differs');
      understanding.ready(input.outputHash);
      const result=a.role==='product'?understanding.applyProduct(a,understanding.parseOutput(input.output),input.outputHash):(()=>{
        const output=parseContract(architectOutput,input.output),context=understanding.sameBasis(job),draft=output.planDraft;
        if(draft.requirementRevision!==context.requirementRevision||!input.planContentHash||digest(canonical(draft))!==input.planContentHash)fail('BASIS_SUPERSEDED',409,'Draft is not bound to the current requirement basis');
        const artifacts=new Set(context.sources.filter(s=>s.ref.kind==='artifact').map(s=>canonical({artifactId:s.ref.artifactId,sha256:s.contentHash})));
        for(const item of output.interfaces)if(!artifacts.has(canonical(item.specificationRef)))fail('SOURCE_REFERENCE_INVALID',422,'Interface source is outside frozen input');
        const works=new Map(draft.works.map(w=>[w.workId,w])),requirements=new Set((context.requirements?.requirements as {id:string}[]|undefined)?.map(r=>r.id));
        const done=new Set<string>(),visiting=new Set<string>();
        function visit(id:(typeof draft.works)[number]['workId']){
          if(done.has(id))return;
          const work=works.get(id);
          if(!work||visiting.has(id))return fail('PREPARATION_OUTPUT_INVALID',422,'Draft dependencies must reference existing work and be acyclic');
          visiting.add(id);
          const deps=new Set(work.dependencies.map(d=>d.workId)),slots=new Set(work.outputSpec.map(s=>s.slot));
          if(deps.size!==work.dependencies.length||slots.size!==work.outputSpec.length||work.requirementIds.some(ref=>!requirements.has(ref))||
            work.inputRefs.some(ref=>ref.kind==='artifact'?!artifacts.has(canonical({artifactId:ref.artifactId,sha256:ref.sha256})):!deps.has(ref.workId)||!works.get(ref.workId)?.outputSpec.some(s=>s.slot===ref.outputSlot))||
            work.completionChecks.some(check=>'outputSlot' in check&&!slots.has(check.outputSlot)))fail('PREPARATION_OUTPUT_INVALID',422,'Draft references are invalid');
          for(const dep of deps)visit(dep);
          visiting.delete(id);done.add(id);
        }
        if(works.size!==draft.works.length)fail('PREPARATION_OUTPUT_INVALID',422,'Duplicate Work ID');
        for(const id of works.keys())visit(id);
        return h.publishPlanFacts(run,draft.requirementRevision,Number(run.current_plan_revision??0)+1,draft,input.planContentHash!,String(job.operation_id));
      })();
      exec('UPDATE preparation_jobs SET result_artifact_id=? WHERE job_id=?',result.artifactId,a.job_id!);settle(a,t,'SUCCEEDED');
      exec('UPDATE operations SET result_json=? WHERE operation_id=?',canonical(result),job.operation_id!);return result;
    });},
    recoverPreparations(){return transaction(db,()=>{
      let unresolved=0,notSent=0;
      for(const a of all('SELECT * FROM preparation_attempts WHERE ended_at IS NULL')){
        const step=get('SELECT * FROM preparation_steps WHERE preparation_attempt_id=?',a.preparation_attempt_id!),t=get('SELECT * FROM preparation_a2a_tasks WHERE preparation_attempt_id=?',a.preparation_attempt_id!);
        if(!t&&a.dispatch_sent_at===null){releaseUnsent(a);notSent++;continue;}
        if(step?.state==='RESPONDED'){exec('UPDATE preparation_a2a_tasks SET worker_id=NULL,claim_token=NULL WHERE preparation_attempt_id=?',a.preparation_attempt_id!);continue;}
        if(step?.state==='SENT'||step?.state==='RECONCILE'||!t){
          exec("UPDATE preparation_attempts SET state='RECONCILE' WHERE preparation_attempt_id=?",a.preparation_attempt_id!);exec("UPDATE preparation_jobs SET state='RECONCILE',error_code='PREPARATION_RECOVERY_REQUIRED' WHERE job_id=?",a.job_id!);exec("UPDATE operations SET status='OUTCOME_UNKNOWN' WHERE operation_id=(SELECT operation_id FROM preparation_jobs WHERE job_id=?)",a.job_id!);if(step?.state==='SENT')exec("UPDATE preparation_steps SET state='RECONCILE' WHERE preparation_attempt_id=?",a.preparation_attempt_id!);unresolved++;continue;
        }
        if(t.protocol_state==='submitted')continue;
        settle(a,t,'FAILED','PREPARATION_INTERRUPTED_BEFORE_SEND');notSent++;
      }return {unresolved,notSent};
    });},
  };
  return {execute(method:PreparationMethod,input:unknown):unknown{const parsed=parseContract(preparationRequests[method],input);return (handlers[method] as (value:unknown)=>unknown)(parsed);}};
}
