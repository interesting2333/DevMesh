import { createHash,randomUUID } from 'node:crypto';
import { z } from 'zod';
import { parseContract,roleOutput,opaqueKey } from '@devmesh/contracts';
import { canonical,StorageError } from '@devmesh/storage-sqlite';
import type { SqliteStorage,ExecutionHostView,RuntimeToolView } from '@devmesh/storage-sqlite';
import { SessionStore } from '@devmesh/blob-store';
import type { LocalContentStore,WriteMeta } from '@devmesh/blob-store';
import { ModelError,checkModelRequest,estimateTokens } from './provider.js';
import type { ModelProvider,ModelRequest,ModelResponse,ChatMessage } from './provider.js';
import { RoleRegistry } from './roles.js';
import {ExecutionGrantLease} from './lease.js';

const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
function fail(code:string):never{throw new ModelError(code,false,'not-sent');}
export type ExecutionClaim={endpointId:string;taskId:string;workerId:string;claimToken:string};
export type ToolResult={state:'SUCCEEDED'|'FAILED';value:unknown}|{state:'OUTCOME_UNKNOWN'};
export interface RuntimeTool {
 name:string;description:string;schema:z.ZodType;effectClass:'READ'|'IDEMPOTENT_WRITE'|'NONIDEMPOTENT_WRITE';
 connection?:Record<string,unknown>;
 execute(operationId:string,args:unknown,host:Readonly<ExecutionHostView>,signal:AbortSignal):Promise<ToolResult>;
 query(operationId:string,host:Readonly<ExecutionHostView>,originalArgs?:unknown):Promise<ToolResult>;
}
export type RuntimeOutcome={state:'completed';candidate:{artifactId:string;sha256:string;schemaId:string};sessionId:string}|{state:'failed'|'reconcile';code:string};
export class AgentRuntime {
 readonly sessions:SessionStore;
 readonly roles:RoleRegistry;
 readonly #tools:Map<string,RuntimeTool>;
 constructor(readonly storage:SqliteStorage,readonly content:LocalContentStore,providers:ModelProvider[],tools:RuntimeTool[]=[],readonly tokenLimit=100000){
  if(!Number.isSafeInteger(tokenLimit)||tokenLimit<1)throw new Error('An explicit positive token budget is required');
  this.sessions=new SessionStore(content);this.roles=new RoleRegistry(providers);this.#tools=new Map();
  for(const t of tools){parseContract(opaqueKey,t.name);if(this.#tools.has(t.name))throw new Error('Duplicate tool name');this.#tools.set(t.name,Object.freeze({...t}));}
 }
 async execute(claim:ExecutionClaim,signal=new AbortController().signal):Promise<RuntimeOutcome>{
  let host:ExecutionHostView|undefined,sessionId:string|undefined,started=false,sent=false,responseSaved=false;
  let lease:ExecutionGrantLease|undefined;
  try{
   if(signal.aborted)fail('RUNTIME_ABORTED');
   host=await this.storage.request('getExecutionHost',claim);
   lease=new ExecutionGrantLease(this.storage,claim,permit=>{host!.permit=permit;});await lease.start();signal=AbortSignal.any([signal,lease.signal]);
   const {role,provider}=this.roles.resolve(host.roleSnapshot);
   const tools=role.allowedTools.map(name=>this.#tools.get(name)??fail('TOOL_NOT_CONFIGURED'));
   const definitions=tools.map(t=>({name:t.name,description:t.description,parameters:z.toJSONSchema(t.schema) as Record<string,unknown>}));
   const prompt=await this.content.readText(host.principalId,{kind:'artifact',artifactId:role.promptArtifactId});
   const session=await this.sessions.ensure(host.principalId,host.runId,host.attemptId);sessionId=session.sessionId;
   // An existing request may have reached the provider. Reconciliation owns resumption.
   if(session.lastStepNo)fail('RUNTIME_RESUME_REQUIRES_RECONCILIATION');
   const frozen={provider:provider.config,role:host.roleSnapshot,promptHash:hash(prompt),toolSchemas:definitions.map(t=>({...t,effectClass:this.#tools.get(t.name)!.effectClass,connection:this.#tools.get(t.name)!.connection??null})),tokenLimit:this.tokenLimit};
   const configHash=hash(frozen);
   await this.storage.request('beginRuntimeActivation',{...claim,activationId:host.activationId,principalId:host.principalId,sessionId,configHash,config:z.record(z.string(),z.json()).parse(frozen),maxSteps:role.maxSteps,tokenLimit:this.tokenLimit});started=true;
   const meta=():WriteMeta=>({principalId:host!.principalId,scopeId:host!.runId,idempotencyKey:randomUUID()});
   const materials:{artifactId:string;sha256:string;text:string}[]=[];
   const refs=[...(host.inputManifest.interfaces as {artifactId:string;sha256:string}[]),...(host.inputManifest.artifacts as {artifactId:string;sha256:string}[])];
   for(const ref of refs){const text=await this.content.readText(host.principalId,{kind:'artifact',artifactId:ref.artifactId});if(createHash('sha256').update(text).digest('hex')!==ref.sha256)fail('INPUT_BASIS_CHANGED');materials.push({...ref,text});}
   await this.sessions.append(meta(),{kind:'message',sessionId,activationId:host.activationId,clientMessageId:'runtime.input.'+host.activationId,messageKind:'user'},canonical({work:host.work,requirements:host.requirements,inputManifest:host.inputManifest,materials}));
   for(let turn=0;turn<role.maxSteps;turn++){
    if(signal.aborted)fail('RUNTIME_ABORTED');
    const session=await this.storage.request('getSession',{principalId:host.principalId,sessionId});
    if(session.lastMessageSeq>200)fail('CONTEXT_COMPRESSION_REQUIRED');
    const messages:ChatMessage[]=[{role:'system',content:prompt}];
    const history=await this.storage.request('listSessionMessages',{principalId:host.principalId,sessionId,limit:200});
    for(const m of history.messages){
     const body=await this.content.readText(host.principalId,{kind:'message',messageId:m.messageId});
     if(m.kind==='assistant'){const response=JSON.parse(body) as ModelResponse;messages.push({role:'assistant',content:response.content,toolCalls:response.toolCalls});}
     else if(m.kind==='tool-result'){messages.push({role:'tool',content:body,toolCallId:m.toolCallId!});}
     else if(m.kind!=='tool-call')messages.push({role:'user',content:body});
    }
    const request:ModelRequest={messages,tools:definitions,maxOutputTokens:role.outputReserveTokens,jsonOutput:provider.config.capabilities.structuredOutput==='json-object'};
    checkModelRequest(provider.config,request);const reserved=estimateTokens({messages,tools:definitions})+request.maxOutputTokens;
    if(reserved>role.contextLimitTokens)fail('CONTEXT_LIMIT');
    await this.storage.request('assertRuntimeActivation',{activationId:host.activationId,reservedTokens:reserved});
    const context=await this.sessions.snapshot(meta(),sessionId,configHash),stepNo=session.lastStepNo+1;
    await this.sessions.saveRequest(meta(),{kind:'modelRequest',sessionId,stepNo,contextSnapshotId:String(context.result!.contextSnapshotId),configHash},request);
    await this.storage.request('markRuntimeModelSent',{activationId:host.activationId,stepNo,reservedTokens:reserved});sent=true;responseSaved=false;
    const response=await provider.complete(request,signal);
    const saved=await this.sessions.saveResponse(meta(),{kind:'modelResponse',sessionId,stepNo,activationId:host.activationId,state:response.finishReason==='stop'||response.finishReason==='tool_calls'?'RESPONDED':'INTERRUPTED',providerRequestId:response.requestId,usage:response.usage},response);responseSaved=true;sent=false;
    await this.storage.request('accountRuntimeModel',{activationId:host.activationId,stepNo});
    if(!['stop','tool_calls'].includes(response.finishReason))fail('MODEL_RESPONSE_INCOMPLETE');
    if(response.toolCalls.length){
     // Validate every call before allowing any member of this response to run.
     const calls=response.toolCalls.map(call=>{
      parseContract(opaqueKey,call.id);const tool=tools.find(t=>t.name===call.name);if(!tool)fail('TOOL_NOT_ALLOWED');
      let args:unknown;try{args=JSON.parse(call.arguments);}catch{fail('TOOL_ARGUMENTS_INVALID');}
      const parsed=tool.schema.safeParse(args);if(!parsed.success)fail('TOOL_ARGUMENTS_INVALID');return {call,tool,args:parsed.data};
     });
     for(const {call,tool,args} of calls){
      if(signal.aborted)fail('RUNTIME_ABORTED');await this.storage.request('assertRuntimeActivation',{activationId:host.activationId});
      const arg=await this.content.putJson(meta(),{kind:'content'},args);
      const operation=await this.storage.request('prepareRuntimeTool',{activationId:host.activationId,stepNo,toolCallId:call.id,toolName:tool.name,argsHash:arg.expectedHash,responseHash:saved.expectedHash,effectClass:tool.effectClass});
      await this.sessions.append(meta(),{kind:'message',sessionId,activationId:host.activationId,clientMessageId:'tool-call.'+stepNo+'.'+call.id,messageKind:'tool-call',stepNo,toolCallId:call.id},canonical({name:tool.name,arguments:args,operationId:operation.operationId}));
      if(operation.state!=='PREPARED')fail('TOOL_REQUIRES_RECONCILIATION');
      await this.storage.request('markRuntimeToolSent',{activationId:host.activationId,operationId:operation.operationId});
      let result:ToolResult;try{result=await tool.execute(operation.operationId,args,Object.freeze(structuredClone(host)),signal);}catch{result={state:'OUTCOME_UNKNOWN'};}
      if(result.state==='OUTCOME_UNKNOWN'){
       await this.storage.request('markRuntimeToolUnknown',{activationId:host.activationId,operationId:operation.operationId,errorCode:'TOOL_OUTCOME_UNKNOWN'});
       try{result=await tool.query(operation.operationId,Object.freeze(structuredClone(host)),args);}catch{result={state:'OUTCOME_UNKNOWN'};}
      }
      if(result.state==='OUTCOME_UNKNOWN')fail('TOOL_OUTCOME_UNKNOWN');
      // On a disk failure after execute, retain SENT/UNKNOWN; never re-execute.
      try{await this.saveToolResult(host,operation,result);}catch{fail('TOOL_RESULT_PERSISTENCE_FAILED');}
     }
     continue;
    }
    let output:unknown;try{output=JSON.parse(response.content);}catch{fail('ROLE_OUTPUT_INVALID');}
    const parsed=roleOutput.safeParse(output);if(!parsed.success||parsed.data.role!==role.role)fail('ROLE_OUTPUT_INVALID');
    const body=await this.content.putJson(meta(),{kind:'content'},parsed.data);
    const candidate=await this.storage.request('publishRuntimeResult',{activationId:host.activationId,stepNo,contentHash:body.expectedHash,output:z.record(z.string(),z.json()).parse(parsed.data)});
    return {state:'completed',candidate,sessionId};
   }
   return fail('MODEL_STEP_LIMIT');
  }catch(error){
   const code=error instanceof ModelError||error instanceof StorageError?error.code:'RUNTIME_INVALID_RESPONSE';
   if(sent&&!responseSaved&&host&&sessionId&&error instanceof ModelError&&error.outcome!=='unknown'){
    try{const session=await this.storage.request('getSession',{principalId:host.principalId,sessionId});await this.sessions.saveResponse({principalId:host.principalId,scopeId:host.runId,idempotencyKey:randomUUID()},{kind:'modelResponse',sessionId,stepNo:session.lastStepNo,activationId:host.activationId,state:'FAILED'},{error:{code,outcome:error.outcome}});responseSaved=true;sent=false;}catch{/* A durable response could not be confirmed. */}
   }
   const unknown=sent&&!responseSaved&&(!(error instanceof ModelError)||error.outcome==='unknown')||['TOOL_OUTCOME_UNKNOWN','TOOL_RESULT_PERSISTENCE_FAILED','RUNTIME_RESUME_REQUIRES_RECONCILIATION','OUTCOME_UNKNOWN','STORAGE_CLOSED'].includes(code);
   if(started&&host)await this.storage.request('setRuntimeState',{activationId:host.activationId,state:unknown?'RECONCILE':'FAILED',reason:code,unknownUsage:sent&&!responseSaved||error instanceof ModelError&&error.outcome==='known-failed'}).catch(()=>{});
    return {state:unknown?'reconcile':'failed',code};
   }finally{await lease?.stop();}
 }
 private async saveToolResult(host:ExecutionHostView,op:RuntimeToolView,result:Exclude<ToolResult,{state:'OUTCOME_UNKNOWN'}>){
  const meta={principalId:host.principalId,scopeId:host.runId,idempotencyKey:randomUUID()};
  const saved=await this.sessions.append(meta,{kind:'message',sessionId:op.sessionId,activationId:op.activationId,stepNo:op.stepNo,toolCallId:op.toolCallId,messageKind:'tool-result',clientMessageId:'tool-result.'+op.stepNo+'.'+op.toolCallId},canonical(result));
  return this.storage.request('finishRuntimeTool',{activationId:op.activationId,operationId:op.operationId,resultMessageId:String(saved.result!.messageId),failed:result.state==='FAILED'});
 }
 /** Queries an existing operation only; no admission, replay or activation restart. */
 async reconcileTool(host:ExecutionHostView,stepNo:number,toolCallId:string,toolName:string){
  const op=await this.storage.request('getRuntimeTool',{activationId:host.activationId,stepNo,toolCallId});if(!op)fail('TOOL_OPERATION_NOT_FOUND');
  if(op.toolName!==toolName)fail('TOOL_OPERATION_MISMATCH');
  if(op.state==='SUCCEEDED'||op.state==='FAILED')return op;
  let cursor=0,originalArgs:unknown;
  for(;;){const page=await this.storage.request('listSessionMessages',{principalId:host.principalId,sessionId:op.sessionId,afterSeq:cursor,limit:200});
   const call=page.messages.find(m=>m.kind==='tool-call'&&m.stepNo===stepNo&&m.toolCallId===toolCallId);
   if(call){const body=JSON.parse(await this.content.readText(host.principalId,{kind:'message',messageId:call.messageId})) as {name:string;operationId:string;arguments:unknown};if(body.name!==toolName||body.operationId!==op.operationId||hash(body.arguments)!==op.argsHash)fail('TOOL_OPERATION_MISMATCH');originalArgs=body.arguments;}
   const found=page.messages.find(m=>m.kind==='tool-result'&&m.stepNo===stepNo&&m.toolCallId===toolCallId);
   if(found){const result=JSON.parse(await this.content.readText(host.principalId,{kind:'message',messageId:found.messageId})) as Exclude<ToolResult,{state:'OUTCOME_UNKNOWN'}>;return this.storage.request('finishRuntimeTool',{activationId:host.activationId,operationId:op.operationId,resultMessageId:found.messageId,failed:result.state==='FAILED'});}
   if(page.messages.length<200)break;cursor=page.messages.at(-1)!.seq;
  }
  if(!['SENT','OUTCOME_UNKNOWN'].includes(op.state))fail('TOOL_NOT_SENT');
  const tool=this.#tools.get(toolName);if(!tool)fail('TOOL_NOT_CONFIGURED');
  const result=await tool.query(op.operationId,Object.freeze(structuredClone(host)),originalArgs);if(result.state==='OUTCOME_UNKNOWN')return op;
  return this.saveToolResult(host,op,result);
 }
}
