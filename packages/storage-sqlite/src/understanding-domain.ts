import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {assertResourceVersion,parseContract,understandingOutput,understandingView} from '@devmesh/contracts';
import type {UnderstandingOutput,WorkRevision} from '@devmesh/contracts';
import {canonical} from './json.js';
import {digest,transaction} from './migrations.js';
import {StorageError} from './errors.js';
import type {Meta,OperationResult} from './protocol.js';
import type {PreparationParsed,PreparationJob,PreparationContext,UnderstandingView} from './preparation-protocol.js';

export type PreparationRow=Record<string,string|number|null>;
export interface PreparationHelpers {
  operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize?:()=>void):OperationResult;
  event(runId:string,operationId:string,type:string,payload:unknown):void;
  outbox(operationId:string,destination:string,payload:unknown):void;
  publishPlanFacts(run:PreparationRow,requirementRevision:number,planRevision:number,plan:{requirementRevision:number;works:WorkRevision[]},planHash:string,operationId:string):{artifactId:string;sha256:string;runId:string;planRevision:number;requirementRevision:number;reviewHash:string;revision:number};
}
export const preparationId=(prefix:string)=>`${prefix}_${randomUUID().replaceAll('-','')}`;
const now=()=>new Date().toISOString();
export const preparationFail=(code:string,status:number,message:string):never=>{throw new StorageError(code,status,message);};

export function createUnderstandingDomain(db:DatabaseSync,h:PreparationHelpers){
  const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as PreparationRow|undefined;
  const all=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as PreparationRow[];
  const exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
  const required=(r:PreparationRow|undefined)=>r??preparationFail('RESOURCE_NOT_FOUND',404,'Preparation resource is not visible');
  const parse=(v:unknown)=>JSON.parse(String(v)) as Record<string,unknown>;
  function authorize(principalId:string,runId:string,write=false){
    const run=required(get('SELECT r.*,m.role AS membership FROM runs r JOIN project_members m ON m.project_id=r.project_id AND m.principal_id=? WHERE r.run_id=?',principalId,runId));
    if(write&&run.membership==='viewer')preparationFail('FORBIDDEN',403,'Project membership is read only');return run;
  }
  function jobView(row:PreparationRow):PreparationJob{return {jobId:String(row.job_id),runId:String(row.run_id),operationId:String(row.operation_id),principalId:String(row.principal_id),purpose:String(row.purpose),role:row.role as 'product'|'architect',state:String(row.state),basisHash:row.basis_hash as string|null,basis:row.basis_json===null?null:parse(row.basis_json),retryOf:row.retry_of as string|null,errorCode:row.error_code as string|null,resultArtifactId:row.result_artifact_id as string|null};}
  const job=(jobId:string)=>required(get('SELECT * FROM preparation_jobs WHERE job_id=?',jobId));
  const ready=(hash:string)=>required(get("SELECT * FROM content_objects WHERE content_hash=? AND state='READY'",hash));
  function newJob(operationId:string,run:PreparationRow,principalId:string,purpose:'UNDERSTAND'|'INTERPRET'|'PLAN',retryOf:string|null=null){
    const id=preparationId('job'),time=now();
    exec("INSERT INTO preparation_jobs(job_id,run_id,operation_id,principal_id,purpose,role,retry_of,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",id,run.run_id!,operationId,principalId,purpose,purpose==='PLAN'?'architect':'product',retryOf,time,time);
    exec('INSERT OR IGNORE INTO input_operation_resources VALUES(?,?,?)',operationId,run.project_id!,run.run_id!);
    return job(id);
  }
  function createProcessing(run:PreparationRow,principalId:string,purpose:'INTERPRET'|'PLAN',key:string){
    const operationId=preparationId('op'),time=now();
    exec("INSERT INTO operations VALUES(?,?,?,?,?,?,'WAITING',NULL,?,?)",operationId,principalId,run.run_id!,key,digest(canonical({purpose,key})),purpose==='PLAN'?'PLAN_INPUT':'INTERPRET_ANSWERS',time,time);
    const row=newJob(operationId,run,principalId,purpose);h.outbox(operationId,'understanding',{schemaVersion:1,runId:run.run_id,jobId:row.job_id});return row;
  }
  function sourceContext(row:PreparationRow):PreparationContext{
    const run=authorize(String(row.principal_id),String(row.run_id));
    const messages=all('SELECT m.message_id,m.body_artifact_id,a.content_hash,a.byte_size FROM input_messages m JOIN artifacts a ON a.artifact_id=m.body_artifact_id WHERE m.run_id=? ORDER BY m.rowid LIMIT 201',run.run_id!);
    if(messages.length>200)preparationFail('PREPARATION_INPUT_LIMIT',422,'Preparation requires a bounded source selection');
    const sources:PreparationContext['sources']=messages.map(m=>({ref:{kind:'message',messageId:m.message_id},contentHash:String(m.content_hash),byteSize:Number(m.byte_size),label:`message:${m.message_id}`}));
    const attachments=all('SELECT DISTINCT a.* FROM input_message_attachments x JOIN input_messages m ON m.message_id=x.message_id JOIN attachments a ON a.attachment_id=x.attachment_id WHERE m.run_id=? ORDER BY a.attachment_id',run.run_id!);
    for(const a of attachments){
      if(a.state!=='READY')preparationFail('CONTENT_UNAVAILABLE',409,'A bound source is unavailable');
      const content=ready(String(a.content_hash)),artifactId='artifact_'+digest(String(run.run_id)+':'+String(a.attachment_id)).slice(0,48);
      exec("INSERT OR IGNORE INTO artifacts(artifact_id,project_id,run_id,attempt_id,kind,content_hash,byte_size,storage_key,state,created_at) VALUES(?,?,?,NULL,'INPUT_ATTACHMENT',?,?,?,'READY',?)",artifactId,run.project_id!,run.run_id!,a.content_hash!,a.byte_size!,content.storage_key!,now());
      sources.push({ref:{kind:'artifact',artifactId,sha256:a.content_hash},contentHash:String(a.content_hash),byteSize:Number(a.byte_size),label:String(a.name)});
    }
    if(sources.length>256)preparationFail('PREPARATION_INPUT_LIMIT',422,'Too many preparation sources');
    const answerRows=row.purpose==='INTERPRET'?all('SELECT a.* FROM interpretation_answers x JOIN clarification_answers a ON a.answer_id=x.answer_id WHERE x.job_id=? ORDER BY x.position',row.job_id!):all('SELECT a.* FROM clarification_current c JOIN clarification_answers a ON a.answer_id=c.answer_id WHERE c.run_id=? ORDER BY c.question_id',run.run_id!);
    const answers=answerRows.map(a=>({answerId:String(a.answer_id),questionId:String(a.question_id),questionRevision:Number(a.question_revision),value:JSON.parse(String(a.value_json)) as unknown}));
    const requirements=run.current_requirement_revision===null?null:parse(required(get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',run.run_id!,run.current_requirement_revision!)).content_json);
    const baseCommit=String(required(get('SELECT base_commit FROM user_tasks WHERE task_id=?',run.task_id!)).base_commit);
    const basis={runId:run.run_id,requirementRevision:run.current_requirement_revision,baseCommit,sources:sources.map(s=>({ref:s.ref,contentHash:s.contentHash})),answerIds:answers.map(a=>a.answerId),answerInterventions:run.answer_interventions};
    for(const a of all('SELECT b.path,a.artifact_id,a.content_hash,a.byte_size FROM preparation_bootstrap_sources b JOIN artifacts a ON a.artifact_id=b.artifact_id WHERE b.job_id=? ORDER BY b.path',row.job_id!))sources.push({ref:{kind:'artifact',artifactId:a.artifact_id,sha256:a.content_hash},contentHash:String(a.content_hash),byteSize:Number(a.byte_size),label:'git:'+String(a.path)});
    if(sources.length>256)preparationFail('PREPARATION_INPUT_LIMIT',422,'Too many preparation sources');
    return {job:jobView(row),basisHash:digest(canonical(basis)),basis,baseCommit,requirementRevision:run.current_requirement_revision as number|null,sources,requirements,answers};
  }
  function freezeBasis(row:PreparationRow){const context=sourceContext(row);exec('UPDATE preparation_jobs SET basis_hash=?,basis_json=?,updated_at=? WHERE job_id=?',context.basisHash,canonical(context.basis),now(),row.job_id!);return context;}
  function sameBasis(row:PreparationRow){const context=sourceContext(row);if(row.basis_hash!==context.basisHash)preparationFail('BASIS_SUPERSEDED',409,'Preparation input changed');return context;}
  function writable(principalId:string,runId:string,ifMatch?:string){const run=authorize(principalId,runId,true);assertResourceVersion(ifMatch,Number(run.resource_revision));if(run.terminal_outcome!==null||run.control_gate==='CANCELLING')preparationFail('RUN_NOT_WRITABLE',409,'Run cannot save answers');return run;}
  function scope(meta:Meta,runId:string){if(meta.scopeId!==runId)preparationFail('OPERATION_SCOPE_INVALID',422,'Invalid Run scope');}
  function assertPreparationPhase(run:PreparationRow){
    if(!['PREPARING','UNDERSTANDING','PLANNING'].includes(String(run.phase))||run.terminal_outcome!==null||
      get('SELECT 1 FROM plan_confirmations WHERE run_id=? AND plan_revision=?',run.run_id!,run.current_plan_revision??null))
      preparationFail('PREPARATION_ADMISSION_CLOSED',409,'Run has passed preparation');
  }
  const handlers={
    ensurePreparationJob(input:PreparationParsed<'ensurePreparationJob'>){return transaction(db,()=>{
      const run=authorize(input.principalId,input.runId,true),previous=get('SELECT * FROM preparation_jobs WHERE operation_id=?',input.processingOperationId);
      if(previous){if(previous.run_id!==input.runId||previous.principal_id!==input.principalId)preparationFail('RESOURCE_NOT_FOUND',404,'Processing job is not visible');return jobView(previous);}
      assertPreparationPhase(run);
      required(get("SELECT o.operation_id FROM operations o JOIN input_processing x ON x.operation_id=o.operation_id JOIN input_messages m ON m.message_id=x.message_id WHERE o.operation_id=? AND o.principal_id=? AND m.run_id=? AND o.kind='PROCESS_INPUT' AND o.status='WAITING'",input.processingOperationId,input.principalId,input.runId));
      return jobView(newJob(input.processingOperationId,run,input.principalId,'UNDERSTAND'));
    });},
    getPreparationJob(input:PreparationParsed<'getPreparationJob'>){const row=job(input.jobId);authorize(input.principalId,String(row.run_id));return jobView(row);},
    getPreparationContext(input:PreparationParsed<'getPreparationContext'>){return transaction(db,()=>{const row=job(input.jobId);authorize(input.principalId,String(row.run_id),true);if(row.principal_id!==input.principalId)preparationFail('RESOURCE_NOT_FOUND',404,'Preparation host is not visible');return sourceContext(row);});},
    registerPreparationBootstrap(input:PreparationParsed<'registerPreparationBootstrap'>){return transaction(db,()=>{
      const row=job(input.jobId),run=authorize(input.principalId,String(row.run_id),true);
      if(row.principal_id!==input.principalId||run.control_gate!=='OPEN'||run.terminal_outcome!==null)preparationFail('PREPARATION_ADMISSION_CLOSED',409,'Preparation sources cannot be registered');
      const old=get('SELECT a.artifact_id,a.content_hash FROM preparation_bootstrap_sources b JOIN artifacts a ON a.artifact_id=b.artifact_id WHERE b.job_id=? AND b.path=?',input.jobId,input.path);
      if(old){if(old.content_hash!==input.contentHash)preparationFail('BASIS_SUPERSEDED',409,'Bootstrap source already has a different immutable hash');return {artifactId:String(old.artifact_id),sha256:input.contentHash};}
      if(row.state!=='WAITING'||Number(get('SELECT count(*) AS n FROM preparation_bootstrap_sources WHERE job_id=?',input.jobId)?.n)>=16)preparationFail('PREPARATION_INPUT_LIMIT',422,'Bootstrap source selection is frozen or full');
      const content=ready(input.contentHash),id=preparationId('artifact');
      exec("INSERT INTO artifacts(artifact_id,project_id,run_id,attempt_id,kind,content_hash,byte_size,storage_key,state,created_at) VALUES(?,?,?,NULL,'BOOTSTRAP_INPUT',?,?,?,'READY',?)",id,run.project_id!,run.run_id!,input.contentHash,content.byte_size!,content.storage_key!,now());
      exec('INSERT INTO preparation_bootstrap_sources VALUES(?,?,?,?)',run.run_id!,input.jobId,input.path,id);return {artifactId:id,sha256:input.contentHash};
    });},
    getUnderstanding(input:PreparationParsed<'getUnderstanding'>):UnderstandingView{return transaction(db,()=>{
      const run=authorize(input.principalId,input.runId),revision=input.requirementRevision??run.current_requirement_revision as number|null;
      const understanding=revision===null?undefined:get('SELECT content_json FROM understanding_revisions WHERE run_id=? AND requirement_revision=?',input.runId,revision);
      if(input.requirementRevision!==undefined&&!understanding)preparationFail('RESOURCE_NOT_FOUND',404,'Understanding revision is not visible');
      const questions=revision===null?[]:all(`SELECT q.*,c.state,a.answer_id,a.value_json,a.actor,a.created_at AS answered_at
        FROM clarification_questions q LEFT JOIN clarification_current c ON c.run_id=q.run_id AND c.question_id=q.question_id AND c.question_revision=q.revision
        LEFT JOIN clarification_answers a ON a.answer_id=COALESCE(c.answer_id,(SELECT old.answer_id FROM clarification_answers old
          WHERE old.run_id=q.run_id AND old.question_id=q.question_id AND old.question_revision=q.revision ORDER BY old.rowid DESC LIMIT 1))
        WHERE q.run_id=? AND q.requirement_basis=? ORDER BY q.question_id LIMIT 100`,input.runId,revision).map(q=>({questionId:q.question_id,questionRevision:q.revision,requirementBasis:q.requirement_basis,state:q.state??'SUPERSEDED',content:parse(q.content_json),answer:q.answer_id==null?null:{answerId:q.answer_id,value:JSON.parse(String(q.value_json)) as unknown,actor:q.actor,createdAt:q.answered_at}}));
      const jobs=all('SELECT * FROM preparation_jobs WHERE run_id=? ORDER BY created_at DESC,job_id DESC LIMIT 50',input.runId).map(row=>{
        const {jobId,operationId,purpose,role,state,retryOf,errorCode,resultArtifactId}=jobView(row);
        return {jobId,operationId,purpose,role,state,retryOf,errorCode,resultArtifactId};
      });
      const pendingInputCount=Number(get(`SELECT COUNT(*) AS count FROM input_processing p JOIN input_messages m ON m.message_id=p.message_id
        JOIN operations o ON o.operation_id=p.operation_id WHERE m.run_id=? AND o.status='WAITING'
        AND NOT EXISTS(SELECT 1 FROM preparation_jobs j WHERE j.operation_id=o.operation_id)`,input.runId)?.count??0);
      return parseContract(understandingView,{runId:input.runId,requirementRevision:revision,understanding:understanding?parse(understanding.content_json):null,questions,jobs,pendingInputCount,answerInterventions:Number(run.answer_interventions)});
    });},
    answerPreparationQuestions(input:PreparationParsed<'answerPreparationQuestions'>){scope(input.meta,input.runId);const {meta,ifMatch,...payload}=input;return h.operation(meta,'AnswerQuestions',payload,operationId=>{
      const run=writable(meta.principalId,input.runId,ifMatch);
      assertPreparationPhase(run);
      for(const answer of input.body.answers){
        const q=required(get("SELECT q.content_json,c.question_revision,c.state FROM clarification_current c JOIN clarification_questions q ON q.run_id=c.run_id AND q.question_id=c.question_id AND q.revision=c.question_revision WHERE c.run_id=? AND c.question_id=?",input.runId,answer.questionId));
        if(q.question_revision!==answer.questionRevision||q.state==='SUPERSEDED')preparationFail('QUESTION_SUPERSEDED',409,'Question has changed; retain and reconcile the answer draft');
        const content=parse(q.content_json),options=content.options as {id:string}[];
        if(options.length&&(typeof answer.value!=='string'||!options.some(o=>o.id===answer.value)))preparationFail('ANSWER_INVALID',422,'Select an available option explicitly');
        if(answer.value===null||typeof answer.value==='string'&&answer.value.trim()==='')preparationFail('ANSWER_INVALID',422,'An answer cannot be empty');
      }
      for(const answer of input.body.answers){const answerId=preparationId('answer');exec('INSERT INTO clarification_answers VALUES(?,?,?,?,?,?,?,?)',answerId,input.runId,answer.questionId,answer.questionRevision,canonical(answer.value),meta.principalId,operationId,now());exec("UPDATE clarification_current SET state='ANSWERED',answer_id=? WHERE run_id=? AND question_id=?",answerId,input.runId,answer.questionId);}
      exec('UPDATE runs SET answer_interventions=answer_interventions+1,resource_revision=resource_revision+1 WHERE run_id=?',input.runId);
      const next=createProcessing(run,meta.principalId,'INTERPRET','answer.'+operationId);
      all("SELECT answer_id FROM clarification_current WHERE run_id=? AND state='ANSWERED' ORDER BY question_id",input.runId).forEach((a,i)=>exec('INSERT INTO interpretation_answers VALUES(?,?,?,?)',input.runId,next.job_id!,a.answer_id!,i));
      freezeBasis(next);exec('INSERT INTO input_operation_resources VALUES(?,?,?)',operationId,run.project_id!,input.runId);
      for(const answer of input.body.answers)h.event(input.runId,operationId,'QuestionAnswered',{questionId:answer.questionId,questionRevision:answer.questionRevision});
      return {projectId:run.project_id,runId:input.runId,revision:Number(run.resource_revision)+1,interpretationOperationId:next.operation_id};
    },()=>{authorize(meta.principalId,input.runId,true);});},
    retryPreparationInterpretation(input:PreparationParsed<'retryPreparationInterpretation'>){scope(input.meta,input.runId);const {meta,ifMatch,...payload}=input;return h.operation(meta,'RetryInterpretation',payload,operationId=>{
      const run=writable(meta.principalId,input.runId,ifMatch),previous=required(get("SELECT * FROM preparation_jobs WHERE run_id=? AND operation_id=? AND purpose='INTERPRET' AND principal_id=?",input.runId,input.failedInterpretationOperationId,meta.principalId));
      assertPreparationPhase(run);
      if(previous.state!=='FAILED')preparationFail('INTERPRETATION_NOT_FAILED',409,'Only a definitely failed interpretation can be retried');sameBasis(previous);
      const next=createProcessing(run,meta.principalId,'INTERPRET','interpretation.retry.'+operationId);
      exec('UPDATE preparation_jobs SET retry_of=?,basis_hash=?,basis_json=? WHERE job_id=?',previous.job_id!,previous.basis_hash!,previous.basis_json!,next.job_id!);
      exec('INSERT INTO interpretation_answers SELECT run_id,?,answer_id,position FROM interpretation_answers WHERE job_id=?',next.job_id!,previous.job_id!);
      exec('INSERT INTO input_operation_resources VALUES(?,?,?)',operationId,run.project_id!,input.runId);
      return {projectId:run.project_id,runId:input.runId,revision:Number(run.resource_revision),interpretationOperationId:next.operation_id};
    },()=>{authorize(meta.principalId,input.runId,true);});},
  };
  function applyProduct(attempt:PreparationRow,output:UnderstandingOutput,contentHash:string){
    const row=job(String(attempt.job_id)),context=sameBasis(row),run=authorize(String(row.principal_id),String(row.run_id),true),content=ready(contentHash);
    const allowed=new Set(context.sources.map(s=>canonical(s.ref)));
    const validRef=(ref:unknown)=>{
      if(allowed.has(canonical(ref)))return;
      const r=ref as {kind?:string;requirementId?:string;requirementRevision?:number};
      if(r.kind==='requirement'&&r.requirementRevision===context.requirementRevision&&(context.requirements?.requirements as {id:string}[]|undefined)?.some(q=>q.id===r.requirementId))return;
      preparationFail('SOURCE_REFERENCE_INVALID',422,'Output references a source outside the frozen authorized input');
    };
    for(const r of output.requirements)r.sourceRefs.forEach(validRef);for(const q of output.questions)q.sourceRefs.forEach(validRef);for(const c of output.conflicts)c.sourceRefs.forEach(validRef);
    for(const pending of all("SELECT q.question_id FROM clarification_current c JOIN clarification_questions q ON q.run_id=c.run_id AND q.question_id=c.question_id AND q.revision=c.question_revision WHERE c.run_id=? AND c.state='OPEN' AND json_extract(q.content_json,'$.required')=1",run.run_id!)){
      if(!output.questions.some(q=>q.id===pending.question_id&&q.required))preparationFail('REQUIRED_QUESTION_DROPPED',422,'A required unanswered question cannot be removed by model output');
    }
    const revision=Number(run.current_requirement_revision??0)+1,artifactId=preparationId('artifact'),time=now();
    const requirements={schemaVersion:'devmesh.requirements.v1',role:'product',requirements:output.requirements,assumptions:output.assumptions,questions:output.questions.map(({id,required,reason,blockingScope,defaultOption})=>({id,required,reason,blockingScope,...(defaultOption!==undefined?{defaultOption}:{})}))};
    exec('INSERT INTO requirement_revisions VALUES(?,?,?,?,?)',run.run_id!,revision,digest(canonical(requirements)),canonical(requirements),time);
    exec("INSERT INTO artifacts(artifact_id,project_id,run_id,attempt_id,kind,content_hash,byte_size,storage_key,state,created_at) VALUES(?,?,?,NULL,'UNDERSTANDING',?,?,?,'READY',?)",artifactId,run.project_id!,run.run_id!,contentHash,content.byte_size!,content.storage_key!,time);
    exec('INSERT INTO understanding_revisions VALUES(?,?,?,?,?,?,?)',run.run_id!,revision,row.job_id!,artifactId,contentHash,canonical(output),time);
    exec("UPDATE clarification_current SET state='SUPERSEDED',answer_id=NULL WHERE run_id=?",run.run_id!);
    for(const q of output.questions){
      const questionRevision=Number(get('SELECT max(revision) AS n FROM clarification_questions WHERE run_id=? AND question_id=?',run.run_id!,q.id)?.n??0)+1;
      exec('INSERT INTO clarification_questions VALUES(?,?,?,?,?,?)',run.run_id!,q.id,questionRevision,revision,canonical(q),time);
      exec("INSERT INTO clarification_current VALUES(?,?,?,'OPEN',NULL) ON CONFLICT(run_id,question_id) DO UPDATE SET question_revision=excluded.question_revision,state='OPEN',answer_id=NULL",run.run_id!,q.id,questionRevision);
    }
    exec("UPDATE runs SET current_requirement_revision=?,phase='UNDERSTANDING',resource_revision=resource_revision+1 WHERE run_id=?",revision,run.run_id!);
    h.event(String(run.run_id),String(row.operation_id),'UnderstandingUpdated',{understandingRef:{artifactId,sha256:contentHash}});
    // Planning is a separate, still unconfirmed preparation operation.
    const next=createProcessing(required(get('SELECT * FROM runs WHERE run_id=?',run.run_id!)),String(row.principal_id),'PLAN','planning.'+row.job_id!);freezeBasis(next);
    return {artifactId,sha256:contentHash,requirementRevision:revision};
  }
  return {handlers,authorize,job,jobView,sourceContext,freezeBasis,sameBasis,ready,applyProduct,assertPreparationPhase,parseOutput:(value:unknown)=>parseContract(understandingOutput,value)};
}
