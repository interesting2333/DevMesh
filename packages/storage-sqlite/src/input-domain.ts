import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { assertResourceVersion, domainEvent, parseContract,productOutput } from '@devmesh/contracts';
import { StorageError } from './errors.js';
import { canonical } from './json.js';
import { digest, transaction } from './migrations.js';
import { inputRequests } from './input-protocol.js';
import type { InputMethod, InputParsed, UploadIntake, AttachmentView, WorkspaceView } from './input-protocol.js';
import type { Meta, OperationResult, RunView } from './protocol.js';

type Row=Record<string,string|number|null>;
type FactInput={principalId:string;projectId?:string|undefined;name:string;baseCommit:string;contentHash:string;kind:string;clientMessageId:string};
interface Helpers {
  operation(meta:Meta,kind:string,payload:unknown,action:(operationId:string)=>Record<string,unknown>,authorize?:()=>void):OperationResult;
  createInputFacts(input:FactInput,operationId:string,legacyUnderstanding:boolean):{projectId:string;taskId:string;runId:string;artifactId:string;messageId:string;revision:number};
  event(runId:string,operationId:string,type:string,payload:unknown):void;
  outbox(operationId:string,destination:string,payload:unknown):void;
  runView(row:Row):RunView;
}
const uid=(prefix:string)=>`${prefix}_${randomUUID().replaceAll('-','')}`;
const now=()=>new Date().toISOString();
const fail=(code:string,status:number,message:string):never=>{throw new StorageError(code,status,message);};

export function createInputDomain(db:DatabaseSync,h:Helpers){
  const get=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).get(...args) as Row|undefined;
  const all=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args) as Row[];
  const exec=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).run(...args);
  const required=(row:Row|undefined)=>row??fail('RESOURCE_NOT_FOUND',404,'Resource does not exist or is not visible');
  function authorize(principalId:string,projectId:string,write=false){
    const member=required(get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',projectId,principalId));
    if(write&&member.role==='viewer')fail('FORBIDDEN',403,'Membership is read only');
    return String(member.role) as 'owner'|'operator'|'viewer';
  }
  function authorizedRun(principalId:string,runId:string,write=false){
    const row=required(get('SELECT * FROM runs WHERE run_id=?',runId));authorize(principalId,String(row.project_id),write);return row;
  }
  const ready=(hash:string)=>required(get("SELECT * FROM content_objects WHERE content_hash=? AND state='READY'",hash));
  function ownedAttachments(principalId:string,ids:readonly string[]){
    for(const id of ids)required(get("SELECT a.attachment_id FROM attachments a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.attachment_id=? AND a.owner_id=? AND a.state='READY' AND c.state='READY' AND a.byte_size BETWEEN 1 AND 2097152",id,principalId));
  }
  function bind(messageId:string,ids:readonly string[]){ids.forEach((id,i)=>exec('INSERT INTO input_message_attachments VALUES(?,?,?)',messageId,id,i));}
  function resource(operationId:string,projectId:string,runId:string){exec('INSERT INTO input_operation_resources VALUES(?,?,?)',operationId,projectId,runId);}
  function processing(principalId:string,projectId:string,runId:string,messageId:string,intentHint:string){
    const operationId=uid('op'),time=now();
    exec("INSERT INTO operations VALUES(?,?,?,?,?,?,'WAITING',NULL,?,?)",operationId,principalId,runId,`input.${messageId}`,digest(canonical({messageId,intentHint})),'PROCESS_INPUT',time,time);
    exec('INSERT INTO input_processing VALUES(?,?,?)',messageId,operationId,intentHint);resource(operationId,projectId,runId);
    h.outbox(operationId,'understanding',{schemaVersion:1,projectId,runId,messageId,intentHint});
    return operationId;
  }
  const operationView=(r:Row):OperationResult=>({operationId:String(r.operation_id),status:String(r.status),result:r.result_json===null?null:JSON.parse(String(r.result_json))});
  function visibleOperation(principalId:string,row:Row|undefined){
    const r=required(row);if(r.principal_id!==principalId)fail('RESOURCE_NOT_FOUND',404,'Operation is not visible');
    const linked=get('SELECT project_id FROM input_operation_resources WHERE operation_id=?',r.operation_id!);
    if(linked)authorize(principalId,String(linked.project_id));
    else if(!get('SELECT intake_id FROM upload_intakes WHERE operation_id=? AND principal_id=?',r.operation_id!,principalId))fail('RESOURCE_NOT_FOUND',404,'Operation is not an input API operation');
    return operationView(r);
  }
  const attachmentView=(r:Row):AttachmentView=>({attachmentId:String(r.attachment_id),clientAttachmentId:String(r.client_attachment_id),name:String(r.name),byteSize:Number(r.byte_size),state:String(r.state),createdAt:String(r.created_at)});
  function attachment(principalId:string,attachmentId:string){
    const row=required(get('SELECT * FROM attachments WHERE attachment_id=?',attachmentId));
    if(row.owner_id!==principalId&&!get('SELECT 1 FROM input_message_attachments a JOIN input_messages m ON m.message_id=a.message_id JOIN project_members p ON p.project_id=m.project_id WHERE a.attachment_id=? AND p.principal_id=?',attachmentId,principalId))fail('RESOURCE_NOT_FOUND',404,'Attachment is not visible');
    return row;
  }
  const intakeView=(r:Row,claimed=false):UploadIntake=>({intakeId:String(r.intake_id),operationId:String(r.operation_id),state:String(r.state),stagingKey:String(r.staging_key),requestHash:r.request_hash as string|null,attachmentId:r.attachment_id as string|null,errorCode:r.error_code as string|null,claimed});
  function intake(principalId:string,intakeId:string){return required(get('SELECT * FROM upload_intakes WHERE intake_id=? AND principal_id=?',intakeId,principalId));}
  function finishIntake(row:Row,attachmentId:string){
    const a=required(get("SELECT * FROM attachments WHERE attachment_id=? AND owner_id=? AND state='READY'",attachmentId,row.principal_id!));
    if(a.content_hash!==row.expected_hash||a.name!==row.name||a.client_attachment_id!==row.client_attachment_id||a.byte_size!==row.byte_size)fail('UPLOAD_CONTENT_CONFLICT',409,'Published attachment differs from validated input');
    ready(String(a.content_hash));const time=now();
    exec("UPDATE upload_intakes SET state='READY',content_hash=?,attachment_id=?,error_code=NULL,updated_at=? WHERE intake_id=?",a.content_hash!,attachmentId,time,row.intake_id!);
    exec("UPDATE operations SET status='SUCCEEDED',result_json=?,updated_at=? WHERE operation_id=?",canonical({attachmentId}),time,row.operation_id!);
  }
  function readTransaction<T>(fn:()=>T):T{db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value;}catch(error){if(db.isTransaction)db.exec('ROLLBACK');throw error;}}
  function eventWindow(input:InputParsed<'getInputEventWindow'>){return readTransaction(()=>{
      const r=authorizedRun(input.principalId,input.runId);if(r.project_id!==input.projectId)fail('RESOURCE_NOT_FOUND',404,'Run is not in this project');
      if(input.afterSeq>Number(r.event_seq))fail('EVENT_CURSOR_INVALID',409,'Event cursor is ahead of this Run');
      const events=all('SELECT * FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT ?',input.runId,input.afterSeq,input.limit).map(r=>parseContract(domainEvent,{schemaVersion:r.schema_version,eventId:r.event_id,projectId:r.project_id,runId:r.run_id,seq:r.seq,type:r.type,occurredAt:r.occurred_at,observedAt:r.observed_at,timeSource:r.time_source,resourceRevision:r.resource_revision,requirementRevision:r.requirement_revision,planRevision:r.plan_revision,operationId:r.operation_id,...(r.work_id?{workId:r.work_id}:{}),...(r.attempt_id?{attemptId:r.attempt_id}:{}),payload:JSON.parse(String(r.payload_json))}));
      const headSeq=Number(r.event_seq),first=get('SELECT min(seq) AS seq FROM events WHERE run_id=?',input.runId);
      return {events,nextCursor:events.at(-1)?.seq??input.afterSeq,headSeq,retainedFromSeq:first?.seq===null?Math.min(Number.MAX_SAFE_INTEGER,headSeq+1):Number(first?.seq??headSeq+1)};
    });}
  function bindSpaceSource(source:{conversationId:string;inputRevision:number}|undefined,principalId:string,runId:string){if(!source)return;const c=required(get('SELECT * FROM conversations WHERE conversation_id=? AND owner_id=? AND deleted_at IS NULL',source.conversationId,principalId));if(c.input_revision!==source.inputRevision||['PAUSED','PAUSING','CANCELLING','CANCELLED'].includes(String(c.state)))fail('BASIS_SUPERSEDED',409,'Conversation source changed');exec('INSERT INTO workbench_run_sources VALUES(?,?,?)',runId,source.conversationId,String(c.directory_binding_json));}
  const handlers={
    checkInputAccess(input:InputParsed<'checkInputAccess'>){const projectId=input.projectId??String(authorizedRun(input.principalId,input.runId!,input.write).project_id);return {projectId,membership:authorize(input.principalId,projectId,input.write)};},
    getWorkbenchSource(input:InputParsed<'getWorkbenchSource'>){return readTransaction(()=>{
      const run=authorizedRun(input.principalId,input.runId),ref=input.ref,base={projectId:String(run.project_id),runId:input.runId};
      if(ref.kind==='requirement'){
        const row=required(get('SELECT content_json FROM requirement_revisions WHERE run_id=? AND revision=?',input.runId,ref.requirementRevision)),snapshot=parseContract(productOutput,JSON.parse(String(row.content_json)));
        const requirement=snapshot.requirements.find(r=>r.id===ref.requirementId);if(!requirement)fail('RESOURCE_NOT_FOUND',404,'Source is not visible');
        return {...base,artifactId:null,contentHash:null,label:'需求依据',requirement:requirement!};
      }
      let artifactId:string;
      if(ref.kind==='message')artifactId=String(required(get('SELECT body_artifact_id FROM input_messages WHERE run_id=? AND message_id=?',input.runId,ref.messageId)).body_artifact_id);
      else{
        // A same-Run internal artifact alone is not a public source. The exact
        // ID/hash pair must occur as one source object in a saved review basis.
        const cited=['understanding_revisions','requirement_revisions','plan_revisions'].some(table=>!!get(`SELECT 1 FROM ${table} s,json_tree(s.content_json) j WHERE s.run_id=? AND j.type='object'
          AND json_extract(CASE WHEN j.type='object' THEN j.value ELSE '{}' END,'$.kind')='artifact'
          AND json_extract(CASE WHEN j.type='object' THEN j.value ELSE '{}' END,'$.artifactId')=?
          AND json_extract(CASE WHEN j.type='object' THEN j.value ELSE '{}' END,'$.sha256')=? LIMIT 1`,input.runId,ref.artifactId,ref.sha256));
        if(!cited)fail('RESOURCE_NOT_FOUND',404,'Source is not visible');artifactId=ref.artifactId;
      }
      const a=required(get("SELECT a.content_hash,a.byte_size FROM artifacts a JOIN content_objects c ON c.content_hash=a.content_hash WHERE a.run_id=? AND a.artifact_id=? AND a.state='READY' AND c.state='READY'",input.runId,artifactId));
      if(ref.kind==='artifact'&&ref.sha256!==a.content_hash)fail('RESOURCE_NOT_FOUND',404,'Source is not visible');
      if(Number(a.byte_size)>2*1024*1024)fail('CONTENT_TOO_LARGE',413,'Source exceeds inline read limit');
      return {...base,artifactId,contentHash:String(a.content_hash),label:ref.kind==='message'?'原始输入':'引用材料',requirement:null};
    });},
    createInputProject(input:InputParsed<'createInputProject'>){
      if(input.meta.scopeId!=='projects.create')fail('OPERATION_SCOPE_INVALID',422,'Invalid creation scope');
      const {meta,baseCommit,...payload}=input;
      return h.operation(meta,'CreateInputProject',payload,operationId=>{
        ownedAttachments(meta.principalId,input.attachmentIds);
        const facts=h.createInputFacts({principalId:meta.principalId,name:input.name,baseCommit,contentHash:input.bodyHash,kind:'NEW',clientMessageId:input.clientDraftId},operationId,false);
        bindSpaceSource(input.sourceConversation,meta.principalId,facts.runId);bind(facts.messageId,input.attachmentIds);resource(operationId,facts.projectId,facts.runId);
        const understandingOperationId=processing(meta.principalId,facts.projectId,facts.runId,facts.messageId,'unsure');
        return {...facts,understandingOperationId};
      },()=>{
        // A saved creation receipt must not bypass a subsequent membership revocation.
        const old=get('SELECT r.project_id FROM operations o JOIN input_operation_resources r ON r.operation_id=o.operation_id WHERE o.principal_id=? AND o.scope_id=? AND o.idempotency_key=?',meta.principalId,meta.scopeId,meta.idempotencyKey);
        if(old)authorize(meta.principalId,String(old.project_id),true);
      });
    },
    renameInputProject(input:InputParsed<'renameInputProject'>){
      const {meta,...payload}=input;
      if(meta.scopeId!==input.projectId)fail('OPERATION_SCOPE_INVALID',422,'Invalid project scope');
      return h.operation(meta,'RenameInputProject',payload,operationId=>{
        const project=required(get('SELECT name FROM projects WHERE project_id=?',input.projectId));
        if(project.name!==input.body.previousName)fail('PROJECT_NAME_CHANGED',409,'Project name has changed');
        exec('UPDATE projects SET name=?,updated_at=? WHERE project_id=?',input.body.name,now(),input.projectId);
        const run=required(get('SELECT run_id FROM runs WHERE project_id=? ORDER BY created_at DESC,run_id DESC LIMIT 1',input.projectId));
        resource(operationId,input.projectId,String(run.run_id));
        return {projectId:input.projectId,name:input.body.name};
      },()=>{authorize(meta.principalId,input.projectId,true);});
    },
    createInputTask(input:InputParsed<'createInputTask'>){
      const {meta,ifMatch,...payload}=input;
      if(meta.scopeId!==input.projectId)fail('OPERATION_SCOPE_INVALID',422,'Invalid project scope');
      return h.operation(meta,'CreateInputTask',payload,operationId=>{
        const project=required(get('SELECT * FROM projects WHERE project_id=?',input.projectId));assertResourceVersion(ifMatch,Number(project.revision));
        if(get('SELECT run_id FROM runs WHERE project_id=? AND terminal_outcome IS NULL',input.projectId))fail('ACTIVE_RUN_EXISTS',409,'Project already has an active Run');
        if(project.accepted_release_id!==input.body.baseAcceptedReleaseId)fail('ACCEPTED_RELEASE_CHANGED',409,'Task must start from the current accepted release');
        const release=required(get('SELECT c.code_commit FROM releases r JOIN release_candidates c ON c.candidate_id=r.candidate_id WHERE r.project_id=? AND r.release_id=?',input.projectId,input.body.baseAcceptedReleaseId));
        ownedAttachments(meta.principalId,input.body.goal.attachmentIds);
        const facts=h.createInputFacts({principalId:meta.principalId,projectId:input.projectId,name:String(project.name),baseCommit:String(release.code_commit),contentHash:input.bodyHash,kind:input.body.kind,clientMessageId:input.body.clientDraftId},operationId,false);
        exec('UPDATE user_tasks SET title=? WHERE task_id=?',input.body.title,facts.taskId);
        exec('UPDATE projects SET revision=revision+1 WHERE project_id=?',input.projectId);
        bindSpaceSource(input.sourceConversation,meta.principalId,facts.runId);bind(facts.messageId,input.body.goal.attachmentIds);resource(operationId,input.projectId,facts.runId);
        return {...facts,understandingOperationId:processing(meta.principalId,input.projectId,facts.runId,facts.messageId,'unsure'),projectRevision:Number(project.revision)+1};
      },()=>{authorize(meta.principalId,input.projectId,true);});
    },
    appendInputMessage(input:InputParsed<'appendInputMessage'>){
      const {meta,ifMatch,...payload}=input;
      if(meta.scopeId!==input.runId)fail('OPERATION_SCOPE_INVALID',422,'Invalid Run scope');
      return h.operation(meta,'AppendInputMessage',payload,operationId=>{
        const run=authorizedRun(meta.principalId,input.runId,true);assertResourceVersion(ifMatch,Number(run.resource_revision));
        if(run.terminal_outcome!==null||run.control_gate==='CANCELLING')fail('RUN_NOT_WRITABLE',409,'Run cannot accept new messages');
        if(get('SELECT message_id FROM input_messages WHERE run_id=? AND author=? AND client_message_id=?',input.runId,meta.principalId,input.body.clientMessageId))fail('MESSAGE_KEY_REUSED',409,'Message intent has already been saved under another operation');
        ownedAttachments(meta.principalId,input.body.attachmentIds);const content=ready(input.bodyHash),time=now(),artifactId=uid('artifact'),messageId=uid('message');
        exec("INSERT INTO artifacts(artifact_id,project_id,run_id,kind,content_hash,byte_size,storage_key,state,created_at) VALUES(?,?,?,'USER_INPUT',?,?,?,'READY',?)",artifactId,run.project_id!,input.runId,input.bodyHash,content.byte_size!,content.storage_key!,time);
        exec('INSERT INTO input_messages VALUES(?,?,?,?,?,?,?)',messageId,run.project_id!,input.runId,meta.principalId,artifactId,input.body.clientMessageId,time);
        bind(messageId,input.body.attachmentIds);resource(operationId,String(run.project_id),input.runId);
        const processingOperationId=processing(meta.principalId,String(run.project_id),input.runId,messageId,input.body.intentHint??'unsure');
        exec('UPDATE runs SET resource_revision=resource_revision+1 WHERE run_id=?',input.runId);
        exec('UPDATE projects SET updated_at=? WHERE project_id=?',time,run.project_id!);
        h.event(input.runId,operationId,'InputSaved',{messageId});
        return {projectId:run.project_id,runId:input.runId,messageId,artifactId,processingOperationId,revision:Number(run.resource_revision)+1};
      },()=>{authorizedRun(meta.principalId,input.runId,true);});
    },
    getInputOperation(input:InputParsed<'getInputOperation'>){return visibleOperation(input.principalId,get('SELECT * FROM operations WHERE operation_id=?',input.operationId));},
    lookupInputOperation(input:InputParsed<'lookupInputOperation'>){
      // Validate a known resource scope even when the original operation does not exist.
      if(input.scopeId.startsWith('run_'))authorizedRun(input.principalId,input.scopeId);
      else if(input.scopeId.startsWith('prj_'))authorize(input.principalId,input.scopeId);
      else if(!['projects.create','uploads'].includes(input.scopeId))fail('OPERATION_SCOPE_INVALID',422,'Unknown input scope');
      const row=get('SELECT * FROM operations WHERE principal_id=? AND scope_id=? AND idempotency_key=?',input.principalId,input.scopeId,input.idempotencyKey);
      return row?visibleOperation(input.principalId,row):null;
    },
    getInputWorkspace(input:InputParsed<'getInputWorkspace'>):WorkspaceView{return readTransaction(()=>{
      const membership=authorize(input.principalId,input.projectId),p=required(get('SELECT * FROM projects WHERE project_id=?',input.projectId));
      const latest=required(get('SELECT * FROM runs WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',input.projectId));
      const r=input.runId?required(get('SELECT * FROM runs WHERE project_id=? AND run_id=?',input.projectId,input.runId)):latest;
      const mode=r.run_id===latest.run_id?'current':'history';
      let after=0;
      if(input.afterMessageId)after=Number(required(get('SELECT rowid AS cursor FROM input_messages WHERE run_id=? AND message_id=?',r.run_id!,input.afterMessageId)).cursor);
      const rows=all('SELECT m.*,p.intent_hint FROM input_messages m LEFT JOIN input_processing p ON p.message_id=m.message_id WHERE m.run_id=? AND m.rowid>? ORDER BY m.rowid LIMIT ?',r.run_id!,after,input.limit+1);
      const selected=rows.slice(0,input.limit),allowedActions:WorkspaceView['allowedActions']=[];
      const questions=get(`SELECT COUNT(*) AS total, SUM(json_extract(q.content_json,'$.required')) AS required
        FROM clarification_current c JOIN clarification_questions q ON q.run_id=c.run_id AND q.question_id=c.question_id AND q.revision=c.question_revision
        WHERE c.run_id=? AND c.state='OPEN'`,r.run_id!);
      const preparation={
        understandingAvailable:!!get('SELECT 1 FROM understanding_revisions WHERE run_id=? AND requirement_revision=?',r.run_id!,r.current_requirement_revision??null),
        requiredOpenQuestions:Number(questions?.required??0),
        pending:!!get(`SELECT 1 FROM preparation_jobs WHERE run_id=? AND state IN ('WAITING','READY','ACTIVE','RECONCILE')
          UNION ALL SELECT 1 FROM input_processing p JOIN input_messages m ON m.message_id=p.message_id JOIN operations o ON o.operation_id=p.operation_id
          WHERE m.run_id=? AND o.status='WAITING' LIMIT 1`,r.run_id!,r.run_id!),
      };
      if(membership!=='viewer'&&mode==='current'){
        if(r.terminal_outcome===null&&r.control_gate!=='CANCELLING')allowedActions.push('saveMessage');
        if(r.terminal_outcome===null&&r.control_gate!=='CANCELLING'&&Number(questions?.total)>0)allowedActions.push('answerQuestions');
        if(p.accepted_release_id&&!get('SELECT 1 FROM runs WHERE project_id=? AND terminal_outcome IS NULL',input.projectId))allowedActions.push('createTask');
      }
      return {project:{projectId:input.projectId,name:String(p.name),revision:Number(p.revision),acceptedReleaseId:p.accepted_release_id as string|null},run:h.runView(r),mode,membership,allowedActions,preparation,eventCursor:Number(r.event_seq),messages:selected.map(m=>({messageId:String(m.message_id),author:String(m.author),bodyArtifactId:String(m.body_artifact_id),clientMessageId:String(m.client_message_id),createdAt:String(m.created_at),attachmentIds:all('SELECT attachment_id FROM input_message_attachments WHERE message_id=? ORDER BY position',m.message_id!).map(a=>String(a.attachment_id)),intentHint:m.intent_hint as 'query'|'change'|'unsure'|null})),nextMessageCursor:rows.length>input.limit?String(selected.at(-1)!.message_id):null};
    });},
    listInputProjects(input:InputParsed<'listInputProjects'>){return readTransaction(()=>{
      const rows=all('SELECT p.*,m.role FROM projects p JOIN project_members m ON m.project_id=p.project_id WHERE m.principal_id=? AND (? IS NULL OR p.updated_at<? OR (p.updated_at=? AND p.project_id<?)) ORDER BY p.updated_at DESC,p.project_id DESC LIMIT ?',input.principalId,input.cursor?.updatedAt??null,input.cursor?.updatedAt??null,input.cursor?.updatedAt??null,input.cursor?.projectId??null,input.limit+1);
      const projects=rows.slice(0,input.limit).map(r=>({projectId:String(r.project_id),name:String(r.name),updatedAt:String(r.updated_at),membership:String(r.role)})),last=projects.at(-1);
      return {projects,nextCursor:rows.length>input.limit&&last?{updatedAt:last.updatedAt,projectId:last.projectId}:null};
    });},
    getInputEventWindow:eventWindow,
    listInputEvents(input:InputParsed<'listInputEvents'>){const {events,nextCursor}=eventWindow(input);return {events,nextCursor};},
    getInputAttachment(input:InputParsed<'getInputAttachment'>){return attachmentView(attachment(input.principalId,input.attachmentId));},
    removeInputAttachment(input:InputParsed<'removeInputAttachment'>){return transaction(db,()=>{
      const r=attachment(input.principalId,input.attachmentId);if(r.owner_id!==input.principalId)fail('FORBIDDEN',403,'Only the uploader can remove an unbound attachment');
      if(get('SELECT 1 FROM input_message_attachments WHERE attachment_id=?',input.attachmentId))fail('ATTACHMENT_BOUND',409,'Saved input retains this attachment');
      exec("UPDATE attachments SET state='REMOVED' WHERE attachment_id=?",input.attachmentId);return attachmentView({...r,state:'REMOVED'});
    });},
    claimUploadIntake(input:InputParsed<'claimUploadIntake'>){return transaction(db,()=>{
      const m=input.meta;if(m.scopeId!=='uploads')fail('OPERATION_SCOPE_INVALID',422,'Invalid upload scope');
      const old=get('SELECT i.* FROM operations o JOIN upload_intakes i ON i.operation_id=o.operation_id WHERE o.principal_id=? AND o.scope_id=? AND o.idempotency_key=?',m.principalId,m.scopeId,m.idempotencyKey);
      if(old)return intakeView(old);
      if(get('SELECT 1 FROM operations WHERE principal_id=? AND scope_id=? AND idempotency_key=?',m.principalId,m.scopeId,m.idempotencyKey))fail('IDEMPOTENCY_KEY_REUSED',409,'Key belongs to another command');
      const id=uid('intake'),op=uid('op'),time=now();
      exec("INSERT INTO operations VALUES(?,?,?,?,?,'UPLOAD_INPUT','RUNNING',NULL,?,?)",op,m.principalId,m.scopeId,m.idempotencyKey,digest('intake.pending'),time,time);
      exec("INSERT INTO upload_intakes(intake_id,operation_id,principal_id,claim_token,staging_key,state,created_at,updated_at) VALUES(?,?,?,?,?,'RECEIVING',?,?)",id,op,m.principalId,input.claimToken,`uploads/${id}.part`,time,time);
      return intakeView(intake(m.principalId,id),true);
    });},
    getUploadIntake(input:InputParsed<'getUploadIntake'>){return intakeView(intake(input.principalId,input.intakeId));},
    validateUploadIntake(input:InputParsed<'validateUploadIntake'>){return transaction(db,()=>{
      const r=intake(input.principalId,input.intakeId);
      const expected=digest(canonical({clientAttachmentId:input.clientAttachmentId,name:input.name,byteSize:input.byteSize,contentHash:input.contentHash}));
      if(expected!==input.requestHash)fail('UPLOAD_HASH_INVALID',422,'Request fingerprint is invalid');
      if(r.request_hash!==null&&r.request_hash!==input.requestHash)fail('IDEMPOTENCY_KEY_REUSED',409,'Upload key belongs to different bytes or metadata');
      if(r.state!=='RECEIVING')return intakeView(r);
      if(r.claim_token!==input.claimToken)fail('UPLOAD_IN_PROGRESS',409,'Original upload is still receiving');
      const time=now();exec("UPDATE upload_intakes SET state='VALIDATED',request_hash=?,expected_hash=?,byte_size=?,name=?,client_attachment_id=?,updated_at=? WHERE intake_id=?",input.requestHash,input.contentHash,input.byteSize,input.name,input.clientAttachmentId,time,input.intakeId);
      exec('UPDATE operations SET request_hash=?,updated_at=? WHERE operation_id=?',input.requestHash,time,r.operation_id!);
      return intakeView(intake(input.principalId,input.intakeId));
    });},
    commitUploadIntake(input:InputParsed<'commitUploadIntake'>){return transaction(db,()=>{
      const r=intake(input.principalId,input.intakeId);
      if(r.state==='READY'){if(r.attachment_id!==input.attachmentId||r.content_hash!==input.contentHash)fail('UPLOAD_CONTENT_CONFLICT',409,'Upload already has a different result');return intakeView(r);}
      if(r.state!=='VALIDATED'||r.claim_token!==input.claimToken||r.expected_hash!==input.contentHash)fail('UPLOAD_CLAIM_INVALID',409,'Validated upload claim changed');
      finishIntake(r,input.attachmentId);return intakeView(intake(input.principalId,input.intakeId));
    });},
    failUploadIntake(input:InputParsed<'failUploadIntake'>){return transaction(db,()=>{
      const r=intake(input.principalId,input.intakeId);
      if(r.claim_token!==input.claimToken)fail('UPLOAD_CLAIM_INVALID',409,'Upload claim changed');
      if(!['RECEIVING','VALIDATED'].includes(String(r.state)))return intakeView(r);
      if(r.state==='VALIDATED'&&(get("SELECT 1 FROM object_write_operations WHERE owner_id=? AND owner_scope=? AND state IN ('RECEIVING','SEALED')",input.principalId,`upload.${r.intake_id}`)||get("SELECT 1 FROM attachments WHERE owner_id=? AND client_attachment_id=? AND content_hash=? AND name=? AND byte_size=? AND state='READY'",input.principalId,r.client_attachment_id!,r.expected_hash!,r.name!,r.byte_size!))){
        // A failed acknowledgement cannot erase a published attachment or an
        // unfinished content transaction. Startup reconciles those exact facts.
        const time=now();exec("UPDATE upload_intakes SET error_code='UPLOAD_FINALIZATION_UNKNOWN',updated_at=? WHERE intake_id=?",time,input.intakeId);
        exec("UPDATE operations SET status='OUTCOME_UNKNOWN',result_json=?,updated_at=? WHERE operation_id=?",canonical({errorCode:'UPLOAD_FINALIZATION_UNKNOWN'}),time,r.operation_id!);
        return intakeView(intake(input.principalId,input.intakeId));
      }
      const time=now();exec("UPDATE upload_intakes SET state='FAILED',error_code=?,updated_at=? WHERE intake_id=?",input.errorCode,time,input.intakeId);
      exec("UPDATE operations SET status='FAILED',result_json=?,updated_at=? WHERE operation_id=?",canonical({errorCode:input.errorCode}),time,r.operation_id!);
      return intakeView(intake(input.principalId,input.intakeId));
    });},
    recoverUploadIntakes(){return transaction(db,()=>{
      let interrupted=0;
      for(const r of all("SELECT * FROM upload_intakes WHERE state IN ('RECEIVING','VALIDATED')")){
        if(r.state==='VALIDATED'){
          const a=get("SELECT attachment_id FROM attachments WHERE owner_id=? AND client_attachment_id=? AND content_hash=? AND name=? AND byte_size=? AND state='READY'",r.principal_id!,r.client_attachment_id!,r.expected_hash!,r.name!,r.byte_size!);
          if(a){finishIntake(r,String(a.attachment_id));continue;}
        }
        const time=now();exec("UPDATE upload_intakes SET state='INTERRUPTED',error_code='UPLOAD_INTERRUPTED',updated_at=? WHERE intake_id=?",time,r.intake_id!);
        exec("UPDATE operations SET status='FAILED',result_json=?,updated_at=? WHERE operation_id=?",canonical({errorCode:'UPLOAD_INTERRUPTED'}),time,r.operation_id!);interrupted++;
      }
      return {interrupted};
    });},
  };
  return {execute(method:InputMethod,input:unknown):unknown{const parsed=parseContract(inputRequests[method],input);return (handlers[method] as (input:unknown)=>unknown)(parsed);}};
}
