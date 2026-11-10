import { setTimeout as delay } from 'node:timers/promises';
import { AgentCard, Task, Role, TaskState } from '@a2a-js/sdk';
import type { Message, SendMessageRequest, GetTaskRequest, CancelTaskRequest, ListTasksRequest, StreamResponse, SubscribeToTaskRequest, ListTasksResponse } from '@a2a-js/sdk';
import type { A2ARequestHandler, TaskStore, ServerCallContext } from '@a2a-js/sdk/server';
import { JsonRpcRequestMalformedError, JsonRpcTaskNotFoundError, JsonRpcTaskNotCancelableError, JsonRpcPushNotificationNotSupportedError, JsonRpcUnsupportedOperationError } from '@a2a-js/sdk/errors';
import { parseContract, workDelegation } from '@devmesh/contracts';
import { StorageError } from '@devmesh/storage-sqlite';
import type { SqliteStorage, EndpointConfig } from '@devmesh/storage-sqlite';
import type { AgentRegistry } from './registry.js';

function caller(context:ServerCallContext){if(context.tenant||!context.user?.isAuthenticated)throw new JsonRpcRequestMalformedError({message:'An authenticated internal service identity without tenant is required'});return context.user.userName;}
function protocolError(error:unknown):never{
 if(error instanceof StorageError){if(error.status===404)throw new JsonRpcTaskNotFoundError();if(error.code==='TASK_NOT_CANCELABLE')throw new JsonRpcTaskNotCancelableError();throw new JsonRpcRequestMalformedError({message:error.code});}throw error;
}
export class DurableTaskStore implements TaskStore {
 constructor(readonly storage:SqliteStorage,readonly endpointId:string){}
 async load(taskId:string,context:ServerCallContext):Promise<Task|undefined>{try{const r=await this.storage.request('getA2ATask',{callerId:caller(context),endpointId:this.endpointId,taskId});return Task.fromJSON(r.snapshot);}catch(error){if(error instanceof StorageError&&error.status===404)return undefined;protocolError(error);}}
 async save(task:Task,context:ServerCallContext){
  const c=context.state.get('devmesh.executionClaim') as {workerId:string;claimToken:string;stopVerified?:boolean}|undefined;
  if(!c)throw new JsonRpcUnsupportedOperationError({message:'Task creation requires atomic admission; updates require a durable consumer claim'});
  const states:Record<number,'working'|'input-required'|'auth-required'|'completed'|'failed'|'canceled'|'rejected'>={[TaskState.TASK_STATE_WORKING]:'working',[TaskState.TASK_STATE_INPUT_REQUIRED]:'input-required',[TaskState.TASK_STATE_AUTH_REQUIRED]:'auth-required',[TaskState.TASK_STATE_COMPLETED]:'completed',[TaskState.TASK_STATE_FAILED]:'failed',[TaskState.TASK_STATE_CANCELED]:'canceled',[TaskState.TASK_STATE_REJECTED]:'rejected'};
  const state=states[task.status?.state??0];if(!state)throw new JsonRpcRequestMalformedError({message:'Invalid consumer Task state'});
  await this.storage.request('settleAcceptedWork',{endpointId:this.endpointId,taskId:task.id,workerId:c.workerId,claimToken:c.claimToken,state,snapshot:Task.toJSON(task) as Record<string,never>,stopVerified:c.stopVerified??false});
 }
 async list(params:ListTasksRequest,context:ServerCallContext):Promise<ListTasksResponse>{
  // Filters/order beyond endpoint ownership are explicitly unsupported until implemented.
  if(params.contextId||params.status||params.statusTimestampAfter||params.includeArtifacts)throw new JsonRpcUnsupportedOperationError({message:'Requested task filter is unavailable'});
  const limit=params.pageSize||50;if(!Number.isInteger(limit)||limit<1||limit>100)throw new JsonRpcRequestMalformedError({message:'pageSize must be 1..100'});
  const rows=await this.storage.request('listA2ATasks',{callerId:caller(context),endpointId:this.endpointId,limit,...(params.pageToken?{afterId:params.pageToken}:{})});
  const tasks=rows.tasks.map(r=>Task.fromJSON(r.snapshot));
  if(params.historyLength!==undefined){if(!Number.isInteger(params.historyLength)||params.historyLength<0)throw new JsonRpcRequestMalformedError();for(const task of tasks)task.history=params.historyLength===0?[]:task.history.slice(-params.historyLength);}
  for(const task of tasks)task.artifacts=[];
  return {tasks,nextPageToken:rows.nextPageToken,pageSize:limit,totalSize:rows.totalSize};
 }
}
export class DurableRequestHandler implements A2ARequestHandler {
 readonly tasks:DurableTaskStore;
 constructor(readonly storage:SqliteStorage,readonly registry:AgentRegistry,readonly endpoint:EndpointConfig,readonly card:AgentCard){this.tasks=new DurableTaskStore(storage,endpoint.endpointId);}
 async getAgentCard():Promise<AgentCard>{return this.card;}
 async getAuthenticatedExtendedAgentCard(_params:unknown,context:ServerCallContext):Promise<AgentCard>{caller(context);return this.card;}
 async sendMessage(params:SendMessageRequest,context:ServerCallContext):Promise<Message|Task>{
  const id=caller(context),m=params.message;
  if(!m||m.role!==Role.ROLE_USER||!m.messageId||m.taskId||m.contextId||m.parts.length!==1||m.parts[0]?.content?.$case!=='data')throw new JsonRpcRequestMalformedError({message:'Initial work requires one DataPart, a new messageId and no preassigned Task/context'});
  if(params.configuration?.taskPushNotificationConfig)throw new JsonRpcPushNotificationNotSupportedError();
  try{
   const d=parseContract(workDelegation,m.parts[0].content.value);
   const r=await this.storage.request('acceptA2AWork',{callerId:id,endpointId:this.endpoint.endpointId,endpointRevision:this.endpoint.revision,delegation:d,message:MessageJson(m),...this.registry.version});return Task.fromJSON(r.snapshot);
  }catch(error){if(error instanceof StorageError)protocolError(error);throw new JsonRpcRequestMalformedError({message:error instanceof Error?error.message:'Invalid work payload'});}
 }
 async getTask(params:GetTaskRequest,context:ServerCallContext):Promise<Task>{try{const t=await this.tasks.load(params.id,context);if(!t)throw new JsonRpcTaskNotFoundError();if(params.historyLength!==undefined){if(!Number.isInteger(params.historyLength)||params.historyLength<0)throw new JsonRpcRequestMalformedError();t.history=params.historyLength===0?[]:t.history.slice(-params.historyLength);}return t;}catch(error){protocolError(error);}}
 async cancelTask(params:CancelTaskRequest,context:ServerCallContext):Promise<Task>{try{const r=await this.storage.request('cancelA2ATask',{callerId:caller(context),endpointId:this.endpoint.endpointId,taskId:params.id});return Task.fromJSON(r.snapshot);}catch(error){protocolError(error);}}
 async *sendMessageStream(params:SendMessageRequest,context:ServerCallContext):AsyncGenerator<StreamResponse>{const t=await this.sendMessage(params,context);if(!('id' in t))throw new JsonRpcUnsupportedOperationError();yield* this.follow(t.id,context);}
 async *resubscribe(params:SubscribeToTaskRequest,context:ServerCallContext):AsyncGenerator<StreamResponse>{yield* this.follow(params.id,context);}
 private async *follow(taskId:string,context:ServerCallContext):AsyncGenerator<StreamResponse>{
  let initial;try{initial=await this.storage.request('getA2ATask',{callerId:caller(context),endpointId:this.endpoint.endpointId,taskId});}catch(error){protocolError(error);}
  yield {payload:{$case:'task',value:Task.fromJSON(initial.snapshot)}};
  if(['completed','failed','canceled','rejected','input-required','auth-required'].includes(initial.state))return;
  let cursor=initial.revision;const signal=(context.user as {signal?:AbortSignal}|undefined)?.signal;
  for(;;){if(signal?.aborted)return;let rows;try{rows=await this.storage.request('listA2ATaskEvents',{callerId:caller(context),endpointId:this.endpoint.endpointId,taskId,afterSeq:cursor});}catch(error){protocolError(error);}
   for(const r of rows){cursor=r.seq;const t=Task.fromJSON(r.snapshot);yield {payload:{$case:'task',value:t}};if([TaskState.TASK_STATE_COMPLETED,TaskState.TASK_STATE_FAILED,TaskState.TASK_STATE_CANCELED,TaskState.TASK_STATE_REJECTED,TaskState.TASK_STATE_INPUT_REQUIRED,TaskState.TASK_STATE_AUTH_REQUIRED].includes(t.status?.state??0))return;}
   try{await delay(100,undefined,{signal});}catch(error){if(signal?.aborted)return;throw error;}
  }
 }
 async listTasks(params:ListTasksRequest,context:ServerCallContext):Promise<ListTasksResponse>{return this.tasks.list(params,context);}
 async createTaskPushNotificationConfig():Promise<never>{throw new JsonRpcPushNotificationNotSupportedError();}
 async getTaskPushNotificationConfig():Promise<never>{throw new JsonRpcPushNotificationNotSupportedError();}
 async listTaskPushNotificationConfigs():Promise<never>{throw new JsonRpcPushNotificationNotSupportedError();}
 async deleteTaskPushNotificationConfig():Promise<never>{throw new JsonRpcPushNotificationNotSupportedError();}
}
// Persist wire JSON; protobuf oneof/numeric-enum objects stay at the SDK boundary.
import { Message as MessageCodec } from '@a2a-js/sdk';
const MessageJson=(m:Message)=>MessageCodec.toJSON(m) as Record<string,never>;
