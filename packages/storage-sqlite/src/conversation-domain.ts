import {createAssistantDomain} from './assistant-domain.js';
import {assistantRequests} from './assistant-protocol.js';
import type {AssistantMethod} from './assistant-protocol.js';
import {randomUUID} from 'node:crypto';
import type {DatabaseSync,SQLInputValue} from 'node:sqlite';
import {conversationSummary,conversationView,parseContract,ids} from '@devmesh/contracts';
import type {ConversationMessage,ConversationSummary} from '@devmesh/contracts';
import type {Meta,OperationResult,Parsed} from './protocol.js';
import {conversationRequests} from './conversation-protocol.js';
import type {ConversationMethod,ConversationParsed,ConversationTurn} from './conversation-protocol.js';
import {StorageError} from './errors.js';
import {canonical} from './json.js';
import {transaction,digest} from './migrations.js';
import {createPlanDomain} from './plan-domain.js';
import type {createWorkbenchSpaceDomain} from './workbench-spaces-domain.js';
import {completedRunEffects} from './work-effects.js';
type Row=Record<string,string|number|null>;
type Operation=(meta:Meta,kind:string,payload:unknown,action:(id:string)=>Record<string,unknown>,authorize?:()=>void)=>OperationResult;
const uid=(prefix:string)=>prefix+'_'+randomUUID().replaceAll('-',''),now=()=>new Date().toISOString();
function fail(code:string,status=409):never{throw new StorageError(code,status,'Conversation request cannot be applied');}
const json=(v:unknown)=>v===null?null:JSON.parse(String(v));

export function createConversationDomain(db:DatabaseSync,operation:Operation,event:(runId:string,operationId:string,type:string,payload:unknown)=>void,outbox:(operationId:string,destination:string,payload:unknown)=>void,confirmPlan:(input:Parsed<'confirmPlan'>,operationId:string)=>Record<string,unknown>,spaces:ReturnType<typeof createWorkbenchSpaceDomain>){
 const plans=createPlanDomain(db);
 const get=(sql:string,...v:SQLInputValue[])=>db.prepare(sql).get(...v) as Row|undefined;
 const all=(sql:string,...v:SQLInputValue[])=>db.prepare(sql).all(...v) as Row[];
 const exec=(sql:string,...v:SQLInputValue[])=>db.prepare(sql).run(...v);
 const row=(id:string)=>get('SELECT * FROM conversations WHERE conversation_id=?',id)??fail('RESOURCE_NOT_FOUND',404);
 function authorize(principal:string,id:string,write=false,includeDeleted=false){
  const r=row(id);const membership=r.project_id?get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',r.project_id,principal):null;
  if(r.owner_id!==principal||r.project_id&&!membership||r.deleted_at!=null&&!includeDeleted)fail('RESOURCE_NOT_FOUND',404);
  if(write&&membership?.role==='viewer')fail('FORBIDDEN',403);return r;
 }
 function summary(r:Row):ConversationSummary{return parseContract(conversationSummary,{conversationId:r.conversation_id,title:r.title,projectId:r.project_id,runId:r.run_id,executionMode:r.execution_mode,state:r.state,revision:r.revision,inputRevision:r.input_revision,lastSeq:r.last_seq,updatedAt:r.updated_at,blockReason:r.block_reason,spaceId:r.space_id,directoryPath:JSON.parse(String(r.directory_binding_json??'null'))?.path??null});}
 const messages=(id:string,after=0,limit=100):ConversationMessage[]=>all('SELECT * FROM conversation_messages WHERE conversation_id=? AND seq>? ORDER BY seq LIMIT ?',id,after,limit).map(r=>({messageId:String(r.message_id),seq:Number(r.seq),role:r.role as ConversationMessage['role'],text:String(r.text),attachmentIds:json(r.attachments_json),createdAt:String(r.created_at),turnId:r.turn_id as string|null,planBasis:json(r.basis_json)}));
 function add(id:string,role:string,text:string,attachments:string[]=[],client:string|null=null,turn:string|null=null,basis:unknown=null){
  const r=row(id),seq=Number(r.last_seq)+1,time=now(),messageId=uid('cmsg');
  exec('INSERT INTO conversation_messages VALUES(?,?,?,?,?,?,?,?,?,?)',messageId,id,seq,role,text,canonical(attachments),client,turn,canonical(basis),time);
  exec('UPDATE conversations SET last_seq=?,revision=revision+1,updated_at=? WHERE conversation_id=?',seq,time,id);return {messageId,seq};
 }
 function owned(principal:string,attachments:string[]){for(const id of attachments){const a=get('SELECT state,owner_id FROM attachments WHERE attachment_id=?',id);if(!a||a.owner_id!==principal)fail('RESOURCE_NOT_FOUND',404);if(a.state!=='READY')fail('ATTACHMENT_NOT_READY');}}
 function checked(input:{turnId:string;claimToken:string},current=true){
  const t=get('SELECT * FROM conversation_turns WHERE turn_id=? AND claim_token=?',input.turnId,input.claimToken)??fail('CONVERSATION_CLAIM_CHANGED');
  const c=current?authorize(String(row(String(t.conversation_id)).owner_id),String(t.conversation_id),true):row(String(t.conversation_id));
  if(current&&(t.input_revision!==c.input_revision||['PAUSED','PAUSING','CANCELLED','CANCELLING'].includes(String(c.state))))fail('BASIS_SUPERSEDED');return {t,c};
 }
 function context(input:{turnId:string;claimToken:string}):ConversationTurn{
  const {t,c}=checked(input);const first=Math.max(0,Number(c.last_seq)-100);
  return {turnId:String(t.turn_id),claimToken:String(t.claim_token),actionKey:String(t.action_key),inputRevision:Number(t.input_revision),state:String(t.state),request:json(t.request_json),response:json(t.response_json),action:json(t.action_json),conversation:summary(c),messages:messages(String(c.conversation_id),first),principalId:String(c.owner_id)};
 }
 const assistant=createAssistantDomain(db,{authorize,checked,add,operation});
 let workingAfter='';
 function deletionState(c:Row){
  const id=String(c.conversation_id),principal=String(c.owner_id);
  let reason:'READ_ONLY'|'UNRESOLVED'|'ACTIVE'|null=null;
  if(get("SELECT 1 FROM assistant_applications WHERE conversation_id=? AND state='ACCEPTED'",id)||get("SELECT 1 FROM assistant_tool_calls t JOIN assistant_sessions s USING(session_id) WHERE s.conversation_id=? AND t.state IN ('RUNNING','UNKNOWN')",id))reason='UNRESOLVED';
  else if(c.project_id&&get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',c.project_id,principal)?.role==='viewer')reason='READ_ONLY';
  else if(c.state==='UNKNOWN'||get("SELECT 1 FROM conversation_turns WHERE conversation_id=? AND state IN ('SENT','APPLYING','UNKNOWN')",id))reason='UNRESOLVED';
  else if(['QUEUED','THINKING','WORKING','PAUSING','CANCELLING'].includes(String(c.state))||get("SELECT 1 FROM conversation_turns WHERE conversation_id=? AND state IN ('READY','ACTIVE','RESPONDED')",id))reason='ACTIVE';
  else if(c.run_id){const run=get('SELECT terminal_outcome,control_gate FROM runs WHERE run_id=?',c.run_id);
   if(!run)fail('RESOURCE_NOT_FOUND',404);
   if(run.terminal_outcome===null&&(run.control_gate!=='PAUSED'||c.resume_requested===1))reason='ACTIVE';
   else if(!completedRunEffects(db,String(c.run_id))||get('SELECT 1 FROM preparation_attempts WHERE run_id=? AND ended_at IS NULL',c.run_id))reason='UNRESOLVED';
  }
  return {conversationId:id,title:String(c.title),revision:Number(c.revision),canDelete:reason===null,reason};
 }
 const handlers={
  getConversationDeletionState(input:ConversationParsed<'getConversationDeletionState'>){return deletionState(authorize(input.principalId,input.conversationId));},
  getConversationPageTarget(input:ConversationParsed<'getConversationPageTarget'>){const c=authorize(input.principalId,input.conversationId,false,true);return {conversationId:c.deleted_at==null?input.conversationId:null};},
  lookupConversationOperation(input:ConversationParsed<'lookupConversationOperation'>){authorize(input.principalId,input.conversationId,false,true);const operation=get('SELECT * FROM operations WHERE principal_id=? AND scope_id=? AND idempotency_key=?',input.principalId,input.conversationId,input.idempotencyKey);return operation?{operationId:String(operation.operation_id),status:String(operation.status),result:json(operation.result_json)}:null;},
  deleteConversation(input:ConversationParsed<'deleteConversation'>){const {meta,conversationId:id,body}=input;
   if(meta.scopeId!==id)fail('OPERATION_SCOPE_INVALID',422);
   return operation(meta,'DeleteConversation',{conversationId:id,body},()=>{
    const c=authorize(meta.principalId,id,true);if(c.revision!==body.revision)fail('CONVERSATION_REVISION_CHANGED');
    const state=deletionState(c);if(!state.canDelete)fail(state.reason==='ACTIVE'?'CONVERSATION_ACTION_BUSY':'CONVERSATION_RESULT_UNKNOWN');
    const deletedAt=now();exec('UPDATE conversations SET deleted_at=?,revision=revision+1,updated_at=? WHERE conversation_id=?',deletedAt,deletedAt,id);
    return {conversationId:id,deletedAt};
   },()=>{authorize(meta.principalId,id,true,true);});
  },
  renameConversation(input:ConversationParsed<'renameConversation'>){const {meta,conversationId:id,body}=input;return operation(meta,'RenameConversation',{conversationId:id,body},()=>{
   const c=authorize(meta.principalId,id,true);if(meta.scopeId!==id)fail('OPERATION_SCOPE_INVALID',422);if(c.title!==body.previousName)fail('CONVERSATION_TITLE_CHANGED');
   exec("UPDATE conversations SET title=?,title_kind='MANUAL',revision=revision+1,updated_at=? WHERE conversation_id=?",body.name,now(),id);return {conversationId:id,title:body.name};
  },()=>{authorize(meta.principalId,id,true);});},
  confirmConversationPlan(input:ConversationParsed<'confirmConversationPlan'>){const {meta,conversationId:id,body}=input;return operation(meta,'ConfirmConversationPlan',{conversationId:id,body},operationId=>{
   const c=authorize(meta.principalId,id,true),basis=body.basis;if(meta.scopeId!==id)fail('OPERATION_SCOPE_INVALID',422);
   if(c.input_revision!==body.inputRevision||c.run_id!==basis.runId)fail('BASIS_SUPERSEDED');
   if(!get("SELECT 1 FROM conversation_turns WHERE conversation_id=? AND input_revision=? AND state='DONE'",id,c.input_revision!))fail('BASIS_SUPERSEDED');
   if(!['WAITING_CONFIRMATION','BLOCKED','PAUSED','IDLE'].includes(String(c.state))||get("SELECT 1 FROM conversation_turns WHERE conversation_id=? AND state IN ('READY','ACTIVE','SENT','RESPONDED','APPLYING','UNKNOWN')",id))fail('CONVERSATION_ACTION_BUSY');
   if(get('SELECT 1 FROM conversation_plan_admissions WHERE run_id=? AND plan_revision=?',basis.runId,basis.planRevision))fail('PLAN_ALREADY_CONFIRMED');
   const result=confirmPlan({meta:{...meta,scopeId:basis.runId},runId:basis.runId,planRevision:basis.planRevision,requirementRevision:basis.requirementRevision,reviewHash:basis.reviewHash,ifMatch:'"r'+basis.resourceRevision+'"',...(body.carryForwardHash?{carryForwardHash:body.carryForwardHash}:{})},operationId);
   add(id,'user','确认方案 v'+basis.planRevision,[],null,null,basis);
   add(id,'progress','方案 v'+basis.planRevision+' 已确认。后续进展将依据实际执行条件更新。',[],null,null,basis);
   exec("UPDATE conversations SET state=CASE WHEN state='PAUSED' THEN state ELSE 'WORKING' END,block_reason=NULL,last_observed=NULL WHERE conversation_id=?",id);
   return {...result,conversationId:id};
  },()=>{authorize(meta.principalId,id,true);});},
  createConversation(input:ConversationParsed<'createConversation'>){const {meta,body}=input;
   return operation(meta,'CreateConversation',{body},()=>{
    if(get('SELECT 1 FROM conversations WHERE owner_id=? AND client_id=?',meta.principalId,body.clientConversationId))fail('MESSAGE_KEY_REUSED');
    if(body.projectId&&!get("SELECT 1 FROM project_members WHERE project_id=? AND principal_id=? AND role<>'viewer'",body.projectId,meta.principalId))fail('RESOURCE_NOT_FOUND',404);
    const selected=spaces.forConversation(meta.principalId,body.spaceId,input.binding,input.spaceRevision),id=uid('conv'),time=now();exec("INSERT INTO conversations(conversation_id,owner_id,client_id,title,project_id,execution_mode,state,created_at,updated_at,title_kind,space_id,directory_binding_json) VALUES(?,?,?,?,?,'EXECUTE','IDLE',?,?,?,?,?)",id,meta.principalId,body.clientConversationId,body.title??'新任务',body.projectId??null,time,time,body.title?'MANUAL':'INPUT',selected.row.space_id!,canonical(selected.binding));return {conversationId:id};
   },()=>{spaces.authorized(meta.principalId,body.spaceId??String(spaces.defaultRow(meta.principalId).space_id),true);if(body.projectId&&!get('SELECT 1 FROM project_members WHERE project_id=? AND principal_id=?',body.projectId,meta.principalId))fail('RESOURCE_NOT_FOUND',404);});
  },
  appendConversationMessage(input:ConversationParsed<'appendConversationMessage'>){const {meta,conversationId:id,body}=input;
   return operation(meta,'AppendConversationMessage',{conversationId:id,body},()=>{
    const c=authorize(meta.principalId,id,true);if(get("SELECT 1 FROM assistant_applications WHERE conversation_id=? AND state='ACCEPTED'",id))fail('ASSISTANT_APPLICATION_PENDING');owned(meta.principalId,body.attachmentIds);
    if(get("SELECT 1 FROM conversation_turns WHERE conversation_id=? AND state='APPLYING' AND json_extract(action_json,'$.kind') IS NOT 'ASSISTANT'",id))fail('CONVERSATION_ACTION_BUSY');
    if(get("SELECT 1 FROM conversation_turns WHERE conversation_id=? AND state='UNKNOWN' AND action_json IS NOT NULL AND json_extract(action_json,'$.kind') IS NOT 'ASSISTANT'",id))fail('CONVERSATION_RESULT_UNKNOWN');
    if(get('SELECT 1 FROM conversation_messages WHERE conversation_id=? AND client_id=?',id,body.clientMessageId))fail('MESSAGE_KEY_REUSED');
    if(Number(c.input_revision)>=1000)fail('CONVERSATION_LIMIT');
    const m=add(id,'user',body.text,body.attachmentIds,body.clientMessageId,null,body.observedPlan??null),inputRevision=Number(c.input_revision)+1,time=now();
    const paused=['PAUSED','PAUSING','CANCELLING'].includes(String(c.state));
    const initialTitle=/^(你好|您好|hi|hello|在吗)[！!。.?？\s]*$/i.test(body.text.trim())?'新对话':Array.from(body.text.trim().replace(/\s+/g,' ')||'附件任务').slice(0,24).join('');
    exec("UPDATE conversations SET input_revision=?,execution_mode=?,state=?,block_reason=NULL,last_observed=NULL,title=CASE WHEN input_revision=0 AND title_kind='INPUT' THEN ? ELSE title END WHERE conversation_id=?",inputRevision,body.executionMode,paused?c.state!:'QUEUED',initialTitle,id);
    exec("UPDATE conversation_turns SET state='SUPERSEDED',updated_at=? WHERE conversation_id=? AND state IN ('READY','ACTIVE','SENT','RESPONDED')",time,id);
    if(!paused){exec("INSERT INTO conversation_turns(turn_id,conversation_id,input_revision,trigger_key,state,action_key,created_at,updated_at) VALUES(?,?,?,?,'READY',?,?,?)",uid('turn'),id,inputRevision,'input.'+inputRevision,randomUUID(),time,time);}
    exec('INSERT INTO conversation_authorizations VALUES(?,?,?,?,?,?,NULL,?)',uid('cauth'),id,inputRevision,meta.principalId,body.executionMode,body.text,time);
    return {...m,conversationId:id,inputRevision};
   },()=>{authorize(meta.principalId,id,true);});
  },
  getConversation(input:ConversationParsed<'getConversation'>){const c=authorize(input.principalId,input.conversationId),items=messages(input.conversationId,input.afterSeq,input.limit);return parseContract(conversationView,{conversation:summary(c),canWrite:!c.project_id||get('SELECT role FROM project_members WHERE project_id=? AND principal_id=?',c.project_id,input.principalId)?.role!=='viewer',messages:items,nextCursor:items.length===input.limit&&items.at(-1)!.seq<Number(c.last_seq)?items.at(-1)!.seq:null,pending:all("SELECT turn_id,state,error_code FROM conversation_turns WHERE conversation_id=? AND state IN ('READY','ACTIVE','SENT','RESPONDED','APPLYING','UNKNOWN') ORDER BY created_at DESC LIMIT 10",input.conversationId).map(t=>({turnId:t.turn_id,state:t.state,errorCode:t.error_code}))});},
  listConversations(input:ConversationParsed<'listConversations'>){
   const cursor=input.before?.split('|');if(cursor&&(cursor.length!==2||!/^\d{4}-\d{2}-\d{2}T/.test(cursor[0]!)||!cursor[1]?.startsWith('conv_')))fail('SCHEMA_INVALID',422);
   const selectedSpace=input.spaceId??String(spaces.defaultRow(input.principalId).space_id);spaces.authorized(input.principalId,selectedSpace);
   const rows=all('SELECT c.* FROM conversations c WHERE deleted_at IS NULL AND owner_id=? AND space_id=? AND instr(lower(title),lower(?))>0 AND (? IS NULL OR updated_at<? OR updated_at=? AND conversation_id<?) AND (project_id IS NULL OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=c.project_id AND m.principal_id=?)) ORDER BY updated_at DESC,conversation_id DESC LIMIT ?',input.principalId,selectedSpace,input.query??'',cursor?.[0]??null,cursor?.[0]??null,cursor?.[0]??null,cursor?.[1]??null,input.principalId,input.limit+1),last=rows[input.limit-1];return {conversations:rows.slice(0,input.limit).map(summary),nextCursor:rows.length>input.limit?String(last!.updated_at)+'|'+String(last!.conversation_id):null};
  },
  claimConversationTurn(_input:ConversationParsed<'claimConversationTurn'>){return transaction(db,()=>{
   const t=get("SELECT t.* FROM conversation_turns t JOIN conversations c USING(conversation_id) WHERE c.deleted_at IS NULL AND t.state IN ('READY','RESPONDED','APPLYING') AND t.claim_token IS NULL AND t.input_revision=c.input_revision AND c.state NOT IN ('PAUSED','PAUSING','CANCELLING','CANCELLED') AND (c.project_id IS NULL OR EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=c.project_id AND m.principal_id=c.owner_id AND m.role<>'viewer')) ORDER BY t.created_at,t.rowid LIMIT 1");if(!t)return null;
   const token=randomUUID();exec("UPDATE conversation_turns SET state=CASE WHEN state='READY' THEN 'ACTIVE' ELSE state END,claim_token=?,updated_at=? WHERE turn_id=?",token,now(),t.turn_id!);exec("UPDATE conversations SET state='THINKING',block_reason=NULL WHERE conversation_id=?",t.conversation_id!);return context({turnId:String(t.turn_id),claimToken:token});
  });},
  getConversationContext:context,
  getConversationExecutionFacts(input:ConversationParsed<'getConversationExecutionFacts'>){const c=authorize(input.principalId,input.conversationId);return {works:c.run_id?all(`SELECT p.work_id,v.definition_json,v.role,w.blocked_reason,a.state FROM plan_works p
   JOIN runs r ON r.run_id=p.run_id AND r.current_plan_revision=p.plan_revision
   JOIN works w ON w.run_id=p.run_id AND w.work_id=p.work_id
   JOIN work_revisions v ON v.run_id=p.run_id AND v.work_id=p.work_id AND v.revision=p.work_revision
   LEFT JOIN attempts a ON a.attempt_id=(SELECT t.attempt_id FROM attempts t WHERE t.run_id=p.run_id AND t.work_id=p.work_id AND t.work_revision=p.work_revision ORDER BY t.attempt_no DESC LIMIT 1)
   WHERE p.run_id=? ORDER BY p.work_id LIMIT 30`,c.run_id).map(r=>({workId:String(r.work_id),goal:String(json(r.definition_json).goal),role:String(r.role),state:r.state as string|null,blockedReason:r.blocked_reason as string|null})):[]};},
  narrowConversationPlan(input:ConversationParsed<'narrowConversationPlan'>){return transaction(db,()=>{const {c}=checked(input);exec("UPDATE conversations SET execution_mode='PLAN' WHERE conversation_id=?",c.conversation_id!);exec("UPDATE conversation_authorizations SET mode='PLAN' WHERE conversation_id=? AND input_revision=?",c.conversation_id!,c.input_revision!);return summary(row(String(c.conversation_id)));});},
  registerConversationChange(input:ConversationParsed<'registerConversationChange'>){return transaction(db,()=>{const {t,c}=checked(input),change=get('SELECT * FROM change_proposals WHERE change_id=? AND run_id=?',input.changeId,c.run_id!)??fail('RESOURCE_NOT_FOUND',404);if(t.state!=='APPLYING'||change.state!=='PROPOSED')fail('CHANGE_NOT_PROPOSED');owned(String(c.owner_id),input.attachmentIds);
   exec('INSERT OR IGNORE INTO conversation_changes VALUES(?,?,?,?,?,?,?,?,NULL,?)',input.changeId,c.conversation_id!,input.turnId,c.input_revision!,input.goal,canonical(input.attachmentIds),randomUUID(),randomUUID(),now());
   exec('UPDATE conversation_authorizations SET run_id=? WHERE conversation_id=? AND input_revision=?',c.run_id!,c.conversation_id!,c.input_revision!);const saved=get('SELECT pause_key FROM conversation_changes WHERE change_id=?',input.changeId)!;return {changeId:input.changeId,pauseKey:String(saved.pause_key)};
  });},
  listConversationChanges(input:ConversationParsed<'listConversationChanges'>){return all("SELECT x.*,c.owner_id,c.run_id FROM conversation_changes x JOIN conversations c USING(conversation_id) JOIN change_proposals p ON p.change_id=x.change_id WHERE c.deleted_at IS NULL AND x.applied_operation_id IS NULL AND p.state='PROPOSED' AND c.run_id=p.run_id AND (? OR c.manual_pause=0) AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=c.project_id AND m.principal_id=c.owner_id AND m.role<>'viewer') AND x.input_revision=(SELECT max(a.input_revision) FROM conversation_authorizations a WHERE a.conversation_id=c.conversation_id AND a.run_id=c.run_id) ORDER BY x.created_at LIMIT ?",input.includeManual?1:0,input.limit).map(r=>({changeId:String(r.change_id),conversationId:String(r.conversation_id),principalId:String(r.owner_id),runId:String(r.run_id),goal:String(r.goal_text),adoptKey:String(r.adopt_key),pauseKey:String(r.pause_key)}));},
  adoptConversationChange(input:ConversationParsed<'adoptConversationChange'>){const {meta,...payload}=input;return operation(meta,'AdoptConversationGoal',payload,id=>{
   const x=get('SELECT * FROM conversation_changes WHERE change_id=?',input.changeId)??fail('RESOURCE_NOT_FOUND',404),c=authorize(meta.principalId,String(x.conversation_id),true),run=get('SELECT * FROM runs WHERE run_id=?',c.run_id!)??fail('RESOURCE_NOT_FOUND',404);
   const latest=get('SELECT max(input_revision) n FROM conversation_authorizations WHERE conversation_id=? AND run_id=?',c.conversation_id!,c.run_id!);
   if(c.manual_pause!==0||x.input_revision!==latest?.n||run.control_gate!=='PAUSED'||run.terminal_outcome!==null)fail('CONVERSATION_AUTHORIZATION_CHANGED');
   if(!completedRunEffects(db,String(c.run_id))||get('SELECT 1 FROM preparation_attempts WHERE run_id=? AND ended_at IS NULL',c.run_id!))fail('CONTROL_TARGETS_UNRESOLVED');
   const content=get("SELECT * FROM content_objects WHERE content_hash=? AND state='READY'",input.bodyHash);if(!content||digest(String(x.goal_text))!==input.bodyHash)fail('CONTENT_UNAVAILABLE');
   const attachments=json(x.attachments_json) as string[];owned(meta.principalId,attachments);const time=now(),messageId=uid('message'),artifactId=uid('artifact'),processing=uid('op');
   exec("UPDATE operations SET status='FAILED',result_json=? WHERE status='WAITING' AND operation_id IN (SELECT p.operation_id FROM input_processing p JOIN input_messages m ON m.message_id=p.message_id WHERE m.run_id=?)",canonical({errorCode:'BASIS_SUPERSEDED'}),c.run_id!);
   exec("UPDATE preparation_jobs SET state='SUPERSEDED',error_code='BASIS_SUPERSEDED' WHERE run_id=? AND state IN ('WAITING','READY')",c.run_id!);
   exec("UPDATE clarification_current SET state='SUPERSEDED' WHERE run_id=? AND state='OPEN'",c.run_id!);
   exec("INSERT INTO artifacts(artifact_id,project_id,run_id,kind,content_hash,byte_size,storage_key,state,created_at) VALUES(?,?,?,'USER_INPUT',?,?,?,'READY',?)",artifactId,c.project_id!,c.run_id!,input.bodyHash,content.byte_size!,content.storage_key!,time);
   exec('INSERT INTO input_messages VALUES(?,?,?,?,?,?,?)',messageId,c.project_id!,c.run_id!,meta.principalId,artifactId,'goal.'+input.changeId,time);
   attachments.forEach((a,i)=>exec('INSERT INTO input_message_attachments VALUES(?,?,?)',messageId,a,i));
   exec("INSERT INTO operations VALUES(?,?,?,?,?,?,'WAITING',NULL,?,?)",processing,meta.principalId,c.run_id!,'goal.'+input.changeId,digest(canonical({messageId})),'PROCESS_INPUT',time,time);
   exec('INSERT INTO input_processing VALUES(?,?,?)',messageId,processing,'change');exec('INSERT INTO input_operation_resources VALUES(?,?,?)',processing,c.project_id!,c.run_id!);
   exec("UPDATE change_proposals SET state='CONFIRMED',decision_operation_id=?,updated_at=? WHERE change_id=?",id,time,input.changeId);
   exec('UPDATE conversation_changes SET applied_operation_id=? WHERE change_id=?',id,input.changeId);
   exec("UPDATE runs SET phase='UNDERSTANDING',control_gate='OPEN',current_plan_revision=NULL,run_epoch=run_epoch+1,control_revision=control_revision+1,resource_revision=resource_revision+1,recovery_review_hash=NULL WHERE run_id=?",c.run_id!);
   exec("UPDATE conversations SET state='WORKING',last_observed=NULL,block_reason=NULL,resume_requested=0,resume_waiting_input=0 WHERE conversation_id=?",c.conversation_id!);
   event(String(c.run_id),id,'GoalUpdated',{changeId:input.changeId,messageId});event(String(c.run_id),id,'InputSaved',{messageId});outbox(processing,'understanding',{schemaVersion:1,projectId:c.project_id,runId:c.run_id,messageId});
   return {conversationId:c.conversation_id,projectId:c.project_id,runId:c.run_id,messageId};
  },()=>{const x=get('SELECT conversation_id FROM conversation_changes WHERE change_id=?',input.changeId)??fail('RESOURCE_NOT_FOUND',404);authorize(meta.principalId,String(x.conversation_id),true);});},
  markConversationModelSent(input:ConversationParsed<'markConversationModelSent'>){return transaction(db,()=>{const {t,c}=checked(input);if(Number(c.token_usage)+input.reservedTokens>input.tokenLimit)fail('CONVERSATION_BUDGET_EXHAUSTED');exec('UPDATE conversations SET token_usage=token_usage+? WHERE conversation_id=?',input.reservedTokens,c.conversation_id!);if(t.state!=='ACTIVE'||t.request_json!==null)fail('CONVERSATION_TURN_CHANGED');exec("UPDATE conversation_turns SET state='SENT',request_json=?,updated_at=? WHERE turn_id=?",canonical(input.request),now(),input.turnId);return context(input);});},
  saveConversationResponse(input:ConversationParsed<'saveConversationResponse'>){return transaction(db,()=>{const {t}=checked(input);if(t.state!=='SENT')fail('CONVERSATION_TURN_CHANGED');exec("UPDATE conversation_turns SET state='RESPONDED',response_json=?,updated_at=? WHERE turn_id=?",canonical(input.response),now(),input.turnId);return context(input);});},
  saveConversationInvalidResponse(input:ConversationParsed<'saveConversationInvalidResponse'>){return transaction(db,()=>{const {t,c}=checked(input);if(t.state!=='SENT')fail('CONVERSATION_TURN_CHANGED');exec("UPDATE conversation_turns SET state='FAILED',raw_response_json=?,error_code=?,updated_at=? WHERE turn_id=?",canonical(input.response),input.errorCode,now(),input.turnId);return summary(c);});},
  prepareConversationAction(input:ConversationParsed<'prepareConversationAction'>){return transaction(db,()=>{const {t}=checked(input);if(t.action_json!==null&&t.action_json!==canonical(input.action))fail('IDEMPOTENCY_KEY_REUSED');if(!['RESPONDED','APPLYING'].includes(String(t.state)))fail('CONVERSATION_TURN_CHANGED');exec("UPDATE conversation_turns SET state='APPLYING',action_json=?,updated_at=? WHERE turn_id=?",canonical(input.action),now(),input.turnId);return context(input);});},
  completeConversationTurn(input:ConversationParsed<'completeConversationTurn'>){return transaction(db,()=>{const {t,c}=checked(input);if(t.state==='DONE')return summary(c);if(!['RESPONDED','APPLYING'].includes(String(t.state)))fail('CONVERSATION_TURN_CHANGED');
   const response=json(t.response_json);if(typeof input.result.assistantText==='string')add(String(c.conversation_id),'assistant',input.result.assistantText,[],null,input.turnId);else if(!input.result.assistantReplied)add(String(c.conversation_id),'assistant',response.reply,[],null,input.turnId);exec("UPDATE conversation_turns SET state='DONE',result_json=?,updated_at=? WHERE turn_id=?",canonical(input.result),now(),input.turnId);exec('UPDATE conversations SET state=?,block_reason=? WHERE conversation_id=?',input.state,typeof input.result.assistantBlockReason==='string'?input.result.assistantBlockReason:null,c.conversation_id!);exec('UPDATE conversations SET resume_waiting_input=0 WHERE conversation_id=?',c.conversation_id!);if(response.action==='PAUSE')exec('UPDATE conversations SET resume_requested=0,manual_pause=1 WHERE conversation_id=?',c.conversation_id!);if(response.action==='RESUME')exec('UPDATE conversations SET manual_pause=0 WHERE conversation_id=?',c.conversation_id!);return summary(row(String(c.conversation_id)));});},
  failConversationTurn(input:ConversationParsed<'failConversationTurn'>){return transaction(db,()=>{const {t,c}=checked(input,false);if(c.deleted_at!=null||['DONE','SUPERSEDED'].includes(String(t.state)))return summary(c);exec('UPDATE conversation_turns SET state=?,error_code=?,updated_at=? WHERE turn_id=?',input.unknown?'UNKNOWN':'FAILED',input.errorCode,now(),input.turnId);if(c.input_revision===t.input_revision&&!['PAUSED','PAUSING','CANCELLED','CANCELLING'].includes(String(c.state))){exec('UPDATE conversations SET state=?,block_reason=? WHERE conversation_id=?',input.unknown?'UNKNOWN':'BLOCKED',input.errorCode,c.conversation_id!);}return summary(row(String(c.conversation_id)));});},
  bindConversationRun(input:ConversationParsed<'bindConversationRun'>){return transaction(db,()=>{const {c}=checked(input);const r=get('SELECT project_id FROM runs WHERE run_id=?',input.runId);if(r?.project_id!==input.projectId||!get("SELECT 1 FROM project_members WHERE project_id=? AND principal_id=? AND role<>'viewer'",input.projectId,c.owner_id!))fail('FORBIDDEN',403);const decision=get('SELECT response_json FROM conversation_turns WHERE turn_id=?',input.turnId),goal=String(json(decision?.response_json??null)?.goal??'').trim().replace(/\s+/g,' ').replace(/^(请|帮我|我想要?|希望|需要)(开发|创建|搭建|制作)?/,'');
   const title=Array.from(goal.split(/[。！？\n]/)[0]??'').slice(0,24).join('');
   exec("UPDATE conversations SET project_id=?,run_id=?,last_observed=NULL,title=CASE WHEN title_kind<>'MANUAL' AND ?<>'' THEN ? ELSE title END,title_kind=CASE WHEN title_kind<>'MANUAL' AND ?<>'' THEN 'GOAL' ELSE title_kind END WHERE conversation_id=?",input.projectId,input.runId,title,title,title,c.conversation_id!);exec('UPDATE conversation_authorizations SET run_id=? WHERE conversation_id=? AND input_revision=?',input.runId,c.conversation_id!,c.input_revision!);return summary(row(String(c.conversation_id)));});},
  admitConversationPlan(input:ConversationParsed<'admitConversationPlan'>){const {meta,...payload}=input;return operation(meta,'AuthorizeConversationPlan',payload,id=>{
   const c=authorize(meta.principalId,input.conversationId,true);if(c.execution_mode!=='EXECUTE'||!c.run_id||['PAUSED','PAUSING','CANCELLED','CANCELLING','QUEUED','THINKING'].includes(String(c.state)))fail('CONVERSATION_AUTHORIZATION_CHANGED');
   const auth=get("SELECT * FROM conversation_authorizations WHERE conversation_id=? AND run_id=? ORDER BY input_revision DESC LIMIT 1",input.conversationId,c.run_id);if(!auth||auth.mode!=='EXECUTE')fail('CONVERSATION_AUTHORIZATION_CHANGED');
   const review=plans.getPlanReview({principalId:meta.principalId,runId:ids.run.parse(c.run_id)});if(!review.canConfirm||review.planRevision!==input.planRevision||review.requirementRevision!==input.requirementRevision||review.reviewHash!==input.reviewHash)fail('PLAN_SUPERSEDED');
   if(get('SELECT 1 FROM conversation_plan_admissions WHERE run_id=? AND plan_revision=?',c.run_id,input.planRevision))fail('PLAN_ALREADY_CONFIRMED');
   exec('INSERT INTO conversation_plan_admissions VALUES(?,?,?,?,?,?,?,?)',c.run_id,input.planRevision,input.requirementRevision,auth.authorization_id!,input.reviewHash,meta.principalId,id,now());
   exec('UPDATE runs SET resource_revision=resource_revision+1 WHERE run_id=?',c.run_id);event(String(c.run_id),id,'PlanAuthorized',{planRevision:input.planRevision,authorizationId:auth.authorization_id});outbox(id,'scheduler',{schemaVersion:1,runId:c.run_id,planRevision:input.planRevision});return {runId:c.run_id,authorizationId:auth.authorization_id,planRevision:input.planRevision};
  },()=>{authorize(meta.principalId,input.conversationId,true);});},
  listConversationTextControls(input:ConversationParsed<'listConversationTextControls'>){return all("SELECT c.*,m.text,m.seq FROM conversations c JOIN conversation_messages m ON m.conversation_id=c.conversation_id AND m.role='user' AND m.seq=(SELECT max(u.seq) FROM conversation_messages u WHERE u.conversation_id=c.conversation_id AND u.role='user') WHERE c.deleted_at IS NULL AND m.seq>c.last_control_seq AND (c.project_id IS NULL OR EXISTS(SELECT 1 FROM project_members p WHERE p.project_id=c.project_id AND p.principal_id=c.owner_id AND p.role<>'viewer')) ORDER BY c.updated_at LIMIT ?",input.limit).map(r=>({conversation:summary(r),principalId:String(r.owner_id),text:String(r.text),seq:Number(r.seq)}));},
  markConversationTextControl(input:ConversationParsed<'markConversationTextControl'>){authorize(input.principalId,input.conversationId);exec('UPDATE conversations SET last_control_seq=max(last_control_seq,?) WHERE conversation_id=?',input.seq,input.conversationId);return {checked:true};},
  settleConversationResume(input:ConversationParsed<'settleConversationResume'>){const c=authorize(input.principalId,input.conversationId,true);if(c.resume_key!==input.key)fail('CONVERSATION_REVISION_CHANGED');const run=get('SELECT control_gate FROM runs WHERE run_id=?',c.run_id!);if(run?.control_gate!=='OPEN')fail('CONTROL_NOT_PAUSED');exec("UPDATE conversations SET resume_requested=0,state=CASE WHEN state IN ('QUEUED','THINKING') THEN state ELSE 'WORKING' END WHERE conversation_id=?",input.conversationId);return summary(row(input.conversationId));},
  listWorkingConversations(input:ConversationParsed<'listWorkingConversations'>){
   const read=()=>all("SELECT c.* FROM conversations c WHERE deleted_at IS NULL AND run_id IS NOT NULL AND state NOT IN ('CANCELLED','COMPLETED') AND conversation_id>? AND EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=c.project_id AND m.principal_id=c.owner_id AND m.role<>'viewer') ORDER BY conversation_id LIMIT ?",workingAfter,input.limit);
   let rows=read();if(!rows.length){workingAfter='';rows=read();}workingAfter=String(rows.at(-1)?.conversation_id??'');return rows.map(c=>({principalId:String(c.owner_id),conversation:summary(c),resumeRequested:c.resume_requested===1,resumeWaitingInput:c.resume_waiting_input===1,resumeKey:c.resume_key as string|null}));
  },
  observeConversation(input:ConversationParsed<'observeConversation'>){return transaction(db,()=>{
   const c=authorize(input.principalId,input.conversationId);if(c.input_revision!==input.inputRevision||c.last_observed===input.key)return summary(c);
   if(input.text)add(input.conversationId,'progress',input.text,[],null,null,input.planBasis??null);
   const controls=['PAUSED','PAUSING','CANCELLING','CANCELLED'],transition=c.state==='PAUSING'&&input.state==='PAUSED'||c.state==='CANCELLING'&&input.state==='CANCELLED';
   const next=['QUEUED','THINKING'].includes(String(c.state))||controls.includes(String(c.state))&&!transition?String(c.state):input.state;
   exec('UPDATE conversations SET last_observed=?,state=?,block_reason=? WHERE conversation_id=?',input.key,next,input.reason,input.conversationId);return summary(row(input.conversationId));
  });},
  controlConversation(input:ConversationParsed<'controlConversation'>){const {meta,conversationId:id,body}=input;
   return operation(meta,'ControlConversation',{conversationId:id,body},()=>{
    const c=authorize(meta.principalId,id,true),time=now();
    if(get("SELECT 1 FROM assistant_applications WHERE conversation_id=? AND state='ACCEPTED'",id))fail('ASSISTANT_APPLICATION_PENDING');
    const raw=c.run_id?get('SELECT kind FROM operations WHERE principal_id=? AND scope_id=? AND idempotency_key=?',meta.principalId,c.run_id,meta.idempotencyKey):null;
    const expected={PAUSE:'PauseRun',RESUME:'ResumeRun',CANCEL:'CancelRun',RECONCILE:''}[body.action];
    if(c.revision!==body.revision&&raw?.kind!==expected)fail('CONVERSATION_REVISION_CHANGED');
    if(body.action==='RECONCILE'){
     const pending=get("SELECT * FROM conversation_turns WHERE conversation_id=? AND input_revision=? AND state IN ('UNKNOWN','FAILED') ORDER BY created_at DESC LIMIT 1",id,c.input_revision!);
     if(pending?.response_json){exec("UPDATE conversation_turns SET state=CASE WHEN action_json IS NULL THEN 'RESPONDED' ELSE 'APPLYING' END,claim_token=NULL WHERE turn_id=?",pending.turn_id!);}
     else if(pending?.state==='FAILED'){
      exec("INSERT INTO conversation_turns(turn_id,conversation_id,input_revision,trigger_key,state,action_key,created_at,updated_at) VALUES(?,?,?,?,'READY',?,?,?)",uid('turn'),id,c.input_revision!,'retry.'+pending.turn_id+'.'+c.revision,randomUUID(),time,time);
     }else if(!c.run_id||pending?.state==='UNKNOWN')fail('CONVERSATION_RESULT_UNKNOWN');
     exec("UPDATE conversations SET state=?,block_reason=NULL,revision=revision+1 WHERE conversation_id=?",pending?'QUEUED':'WORKING',id);
    }else if(body.action==='RESUME'){
     if(!['PAUSED','PAUSING'].includes(String(c.state)))fail('CONVERSATION_TURN_CHANGED');
     const prior=get('SELECT * FROM conversation_turns WHERE conversation_id=? AND input_revision=? ORDER BY created_at DESC LIMIT 1',id,c.input_revision!);
     const unresolved=prior?.state==='UNKNOWN',needed=Number(c.input_revision)>0&&(!prior||['SUPERSEDED','FAILED'].includes(String(prior.state)));
     exec('UPDATE conversations SET resume_requested=?,resume_waiting_input=?,resume_key=? WHERE conversation_id=?',c.run_id?1:0,unresolved||needed?1:0,meta.idempotencyKey,id);
     exec("UPDATE conversations SET state=?,block_reason=?,revision=revision+1 WHERE conversation_id=?",unresolved?'UNKNOWN':needed?'QUEUED':c.run_id?'WORKING':'IDLE',unresolved?'CONVERSATION_RESULT_UNKNOWN':null,id);
     if(needed)exec("INSERT INTO conversation_turns(turn_id,conversation_id,input_revision,trigger_key,state,action_key,created_at,updated_at) VALUES(?,?,?,?,'READY',?,?,?)",uid('turn'),id,c.input_revision!,'resume.'+c.revision,randomUUID(),time,time);
    }else{
     exec('UPDATE conversations SET state=?,revision=revision+1 WHERE conversation_id=?',body.action==='PAUSE'?(c.run_id?'PAUSING':'PAUSED'):(c.run_id?'CANCELLING':'CANCELLED'),id);
     exec("UPDATE conversation_turns SET state='SUPERSEDED' WHERE conversation_id=? AND state IN ('READY','ACTIVE','RESPONDED')",id);
    }
    if(body.action==='PAUSE'||body.action==='CANCEL')exec('UPDATE conversations SET manual_pause=1,resume_requested=0 WHERE conversation_id=?',id);
    if(body.action==='RESUME')exec('UPDATE conversations SET manual_pause=0 WHERE conversation_id=?',id);
    if(body.sourceMessageSeq!==undefined){exec('UPDATE conversations SET last_control_seq=max(last_control_seq,?) WHERE conversation_id=?',body.sourceMessageSeq,id);add(id,'progress',body.action==='PAUSE'?(c.run_id?'已收到暂停要求，正在收尾并核实当前工作。':'已暂停。你可以补充说明，明确恢复后再继续。'):body.action==='CANCEL'?'已收到取消要求，正在核实收尾结果。':'已收到恢复要求，将根据当前任务和已保存的指令继续。');}
    return {conversationId:id,runId:c.run_id,action:body.action};
   },()=>{authorize(meta.principalId,id,true);});
  },
  recoverConversationTurns(_input:ConversationParsed<'recoverConversationTurns'>){return transaction(db,()=>{const unknown=exec("UPDATE conversation_turns SET state='UNKNOWN',error_code='CONVERSATION_RESULT_UNKNOWN',claim_token=NULL WHERE state='SENT' AND conversation_id IN (SELECT conversation_id FROM conversations WHERE deleted_at IS NULL)").changes;const ready=exec("UPDATE conversation_turns SET state=CASE WHEN state='ACTIVE' THEN 'READY' ELSE state END,claim_token=NULL WHERE state IN ('ACTIVE','RESPONDED','APPLYING') AND conversation_id IN (SELECT conversation_id FROM conversations WHERE deleted_at IS NULL)").changes;exec("UPDATE conversations SET state='UNKNOWN',block_reason='CONVERSATION_RESULT_UNKNOWN' WHERE deleted_at IS NULL AND EXISTS(SELECT 1 FROM conversation_turns t WHERE t.conversation_id=conversations.conversation_id AND t.input_revision=conversations.input_revision AND t.state='UNKNOWN')");return {unknown:Number(unknown),ready:Number(ready)};});},
 };
 return {deletionState,execute<M extends ConversationMethod>(method:M,input:unknown){if(Object.hasOwn(assistantRequests,method))return assistant.execute(method as AssistantMethod,input);const parsed=parseContract(conversationRequests[method],input);return (handlers[method as keyof typeof handlers] as (value:never)=>unknown)(parsed as never);}};
}
