import type {OperationResult} from './protocol.js';
import {z} from 'zod';
import {opaqueKey,assistantToolName,assistantApplyInput,assistantTaskList,assistantApplicationView,assistantExecutionDetails} from '@devmesh/contracts';
const claim={turnId:opaqueKey,claimToken:z.string().min(1)},session={...claim,sessionId:opaqueKey},selected={principalId:opaqueKey,conversationId:opaqueKey},json=z.record(z.string(),z.json());
export const assistantRequests={
 beginAssistantSession:z.strictObject({...claim,mode:z.enum(['READ','EDIT'])}),
 setAssistantWorkspace:z.strictObject({...session,workspace:json}),
 getAssistantSession:z.strictObject(session),
 readAssistantSession:z.strictObject({...selected,sessionId:opaqueKey}),
 updateAssistantProgress:z.strictObject({...session,result:json}),
 sendAssistantStep:z.strictObject({...session,stepNo:z.number().int().positive(),request:json,reservedTokens:z.number().int().positive(),tokenLimit:z.number().int().positive()}),
 saveAssistantStep:z.strictObject({...session,stepNo:z.number().int().positive(),response:json}),
 prepareAssistantTools:z.strictObject({...session,stepNo:z.number().int().positive(),calls:z.array(z.strictObject({callId:z.string().min(1).max(256),name:assistantToolName,args:json})).max(8)}),
 startAssistantTool:z.strictObject({...session,operationId:opaqueKey}),
 finishAssistantTool:z.strictObject({...session,operationId:opaqueKey,state:z.enum(['SUCCEEDED','FAILED','UNKNOWN']),result:json}),
 finishAssistantStep:z.strictObject({...session,stepNo:z.number().int().positive()}),
 finishAssistantSession:z.strictObject({...session,state:z.enum(['READY','BLOCKED','UNKNOWN']),result:json,errorCode:opaqueKey.nullable().default(null)}),
 getGeneratedRecovery:z.strictObject(selected),
 recoverGeneratedConversation:z.strictObject({meta:z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()}),conversationId:opaqueKey,revision:z.number().int().positive()}),
 listAssistantTasks:z.strictObject(selected),
 readAssistantExecutionDetails:z.strictObject({...selected,sessionId:opaqueKey.optional()}),
 prepareAssistantApplication:z.strictObject({...selected,key:z.uuid(),body:assistantApplyInput,plan:z.array(z.strictObject({path:z.string(),beforeSha256:z.string().nullable(),afterSha256:z.string(),text:z.string()})).max(100)}),
 lookupAssistantApplication:z.strictObject({...selected,key:z.uuid()}),
 finishAssistantApplication:z.strictObject({...selected,key:z.uuid(),state:z.enum(['ACCEPTED','SUCCEEDED','FAILED']),result:json}),
};
export type AssistantMethod=keyof typeof assistantRequests;
export type AssistantParsed<M extends AssistantMethod>=z.output<(typeof assistantRequests)[M]>;
export interface AssistantToolRecord{operationId:string;stepNo:number;callId:string;name:z.output<typeof assistantToolName>;args:Record<string,unknown>;state:'PREPARED'|'RUNNING'|'SUCCEEDED'|'FAILED'|'UNKNOWN';result:Record<string,unknown>|null}
export interface AssistantSession{sessionId:string;conversationId:string;inputRevision:number;mode:'READ'|'EDIT';state:string;workspace:Record<string,unknown>|null;result:Record<string,unknown>;steps:{stepNo:number;state:string;request:Record<string,unknown>;response:Record<string,unknown>|null}[];tools:AssistantToolRecord[]}
export interface AssistantApplication{operationId:string;status:'ACCEPTED'|'SUCCEEDED'|'FAILED';result:Record<string,unknown>|null;sessionId:string;plan:{path:string;beforeSha256:string|null;afterSha256:string;text:string}[];workspace:Record<string,unknown>}
export interface AssistantResults{
 beginAssistantSession:AssistantSession;setAssistantWorkspace:AssistantSession;getAssistantSession:AssistantSession;readAssistantSession:AssistantSession;updateAssistantProgress:AssistantSession;sendAssistantStep:AssistantSession;saveAssistantStep:AssistantSession;prepareAssistantTools:AssistantSession;
 startAssistantTool:{execute:boolean;tool:AssistantToolRecord};finishAssistantTool:AssistantSession;finishAssistantStep:AssistantSession;finishAssistantSession:AssistantSession;
 getGeneratedRecovery:{eligible:boolean;runId:string|null;reason:string|null};recoverGeneratedConversation:OperationResult;
 readAssistantExecutionDetails:z.output<typeof assistantExecutionDetails>;
 listAssistantTasks:z.output<typeof assistantTaskList>;prepareAssistantApplication:AssistantApplication;lookupAssistantApplication:z.output<typeof assistantApplicationView>|null;finishAssistantApplication:z.output<typeof assistantApplicationView>;
}
