import {z} from 'zod';
import {opaqueKey,epoch,revision,timestamp,sha256} from './primitives.js';
export const assistantPath=z.string().min(1).max(512).refine(p=>!p.startsWith('/')&&!p.includes('\\')&&!p.includes(':')&&!p.split('/').some(s=>!s||s==='.'||s==='..'||[...s].some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127)),'A project-relative file path is required');
export const assistantToolArguments={
 project_list:z.strictObject({prefix:z.string().max(512).default(''),offset:epoch.default(0)}),
 project_read:z.strictObject({path:assistantPath,offset:epoch.default(0)}),
 project_search:z.strictObject({query:z.string().min(1).max(200),prefix:z.string().max(512).default('')}),
 project_write:z.strictObject({path:assistantPath,expectedSha256:sha256.nullable(),text:z.string().max(65536)}),
 project_patch:z.strictObject({path:assistantPath,expectedSha256:sha256,search:z.string().min(1).max(20000),replacement:z.string().max(65536)}),
 project_diff:z.strictObject({}),
 project_check:z.strictObject({check:z.enum(['build','test','lint','html'])}),
};
export const assistantToolName=z.enum(['project_list','project_read','project_search','project_write','project_patch','project_diff','project_check']);
export const assistantChange=z.strictObject({path:assistantPath,beforeSha256:sha256.nullable(),afterSha256:sha256,added:epoch,removed:epoch,diff:z.string().max(40000)});
export const assistantCheck=z.strictObject({operationId:opaqueKey,check:z.enum(['build','test','lint','html']),state:z.enum(['RUNNING','SUCCEEDED','FAILED','UNKNOWN']),exitCode:z.number().int().nullable(),output:z.string().max(65536),completedAt:timestamp.optional(),durationMs:epoch,sourceHash:sha256,backend:z.enum(['DOCKER_DEVELOPMENT','STATIC_HTML']).optional()});
export const assistantArtifact=z.strictObject({path:assistantPath,sha256,size:epoch});
export const assistantLiveFrame=z.strictObject({conversationId:opaqueKey,inputRevision:epoch,turnId:opaqueKey,streamId:opaqueKey,status:z.enum(['thinking','generating','checking','completed','blocked','interrupted']),stage:z.string().max(300),text:z.string().max(20000),receivedChars:epoch,updatedAt:timestamp,seq:epoch});
export type AssistantLiveFrame=z.output<typeof assistantLiveFrame>;
export type AssistantLiveUpdate=Omit<AssistantLiveFrame,'seq'>&{principalId:string};
export const assistantTaskView=z.strictObject({sessionId:opaqueKey,inputRevision:epoch,mode:z.enum(['READ','EDIT']),workspaceKind:z.enum(['BOUND','GENERATED']).default('BOUND'),files:z.array(assistantArtifact).max(100).default([]),state:z.enum(['RUNNING','READY','BLOCKED','UNKNOWN','SUPERSEDED']),updatedAt:timestamp,changes:z.array(assistantChange).max(100),checks:z.array(assistantCheck).max(50),verified:z.boolean(),applied:z.boolean(),error:opaqueKey.nullable()});
export const assistantTaskList=z.strictObject({tasks:z.array(assistantTaskView).max(20)});
export const assistantExecutionSummary=assistantTaskView.pick({sessionId:true,inputRevision:true,mode:true,workspaceKind:true,state:true,updatedAt:true}).extend({
 goal:z.string().max(120).default(''),
 startedAt:timestamp.optional(),
});
export const assistantExecutionActivity=z.strictObject({id:opaqueKey,kind:z.enum(['SESSION','MODEL','TOOL','APPLICATION']),state:opaqueKey,startedAt:timestamp,updatedAt:timestamp,stepNo:epoch.optional(),tool:assistantToolName.optional(),path:assistantPath.optional(),check:z.enum(['build','test','lint','html']).optional(),exitCode:z.number().int().nullable().optional()});
export const assistantExecutionDetails=z.strictObject({conversationId:opaqueKey,currentInputRevision:epoch,sessionCount:epoch,sessions:z.array(assistantExecutionSummary).max(20),currentGoal:z.string().max(20000).default(''),previousResult:opaqueKey.nullable().optional(),previousPreview:opaqueKey.nullable().optional(),selected:z.strictObject({task:assistantTaskView,createdAt:timestamp,goal:z.string().max(20000),reply:z.string().max(20000),modelSteps:epoch,toolCalls:epoch,activities:z.array(assistantExecutionActivity).max(200),totalActivities:epoch}).nullable()});
export type AssistantExecutionDetails=z.output<typeof assistantExecutionDetails>;
export const assistantApplyInput=z.strictObject({sessionId:opaqueKey,revision});
export const assistantApplicationView=z.strictObject({operationId:opaqueKey,status:z.enum(['ACCEPTED','SUCCEEDED','FAILED']),result:z.record(z.string(),z.json()).nullable()});
export const assistantEnvironment=z.strictObject({analysis:z.boolean(),editing:z.boolean(),commands:z.boolean(),backend:z.enum(['DISABLED','DOCKER_DEVELOPMENT']),reason:opaqueKey.nullable()});
export type AssistantToolName=z.output<typeof assistantToolName>;
export type AssistantTaskView=z.output<typeof assistantTaskView>;
export type AssistantEnvironment=z.output<typeof assistantEnvironment>;
export interface AssistantHost {principalId:string;conversationId:string;sessionId:string;workspace:Record<string,unknown>;assertCurrent:()=>Promise<void>}
export interface AssistantBackend {
 capabilities():AssistantEnvironment;
 artifact?(workspace:Record<string,unknown>,path:string,expectedSha256:string):Promise<Uint8Array>;
 prepare(principalId:string,conversationId:string,sessionId:string,previous?:Record<string,unknown>):Promise<Record<string,unknown>>;
 execute(host:AssistantHost,name:AssistantToolName,args:Record<string,unknown>,operationId:string,signal:AbortSignal):Promise<Record<string,unknown>>;
 recover?(host:AssistantHost,name:AssistantToolName,args:Record<string,unknown>,operationId:string):Promise<Record<string,unknown>|null>;
 query(host:AssistantHost,name:AssistantToolName,args:Record<string,unknown>,operationId:string):Promise<Record<string,unknown>|null>;
 result(host:AssistantHost):Promise<Record<string,unknown>>;
 applicationPlan(workspace:Record<string,unknown>):Promise<{path:string;beforeSha256:string|null;afterSha256:string;text:string}[]>;
 apply(workspace:Record<string,unknown>,operationId:string,plan:{path:string;beforeSha256:string|null;afterSha256:string;text:string}[],assertCurrent:()=>Promise<void>):Promise<Record<string,unknown>>;
}
