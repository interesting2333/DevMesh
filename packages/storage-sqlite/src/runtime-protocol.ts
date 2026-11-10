import { z } from 'zod';
import { ids,opaqueKey,revision,sha256 } from '@devmesh/contracts';
const claim={endpointId:opaqueKey,taskId:opaqueKey,workerId:opaqueKey,claimToken:opaqueKey};
const activation={activationId:ids.activation};
export const runtimeRequests={
 getExecutionHost:z.strictObject(claim),
 getAcceptedTaskSnapshot:z.strictObject(claim),
 reconcileRuntimeTask:z.strictObject({...claim,reason:opaqueKey}),
 beginRuntimeActivation:z.strictObject({...claim,...activation,principalId:opaqueKey,sessionId:ids.session,configHash:sha256,config:z.record(z.string(),z.json()),maxSteps:z.number().int().min(1).max(200),tokenLimit:z.number().int().min(1)}),
 assertRuntimeActivation:z.strictObject({...activation,reservedTokens:z.number().int().nonnegative().default(0)}),
 accountRuntimeModel:z.strictObject({...activation,stepNo:revision}),
 markRuntimeModelSent:z.strictObject({...activation,stepNo:revision,reservedTokens:z.number().int().positive()}),
 setRuntimeState:z.strictObject({...activation,state:z.enum(['WAITING','FINISHED','FAILED','RECONCILE']),reason:opaqueKey.optional(),unknownUsage:z.boolean().default(false)}),
 prepareRuntimeTool:z.strictObject({...activation,stepNo:revision,toolCallId:opaqueKey,toolName:opaqueKey,argsHash:sha256,responseHash:sha256,effectClass:z.enum(['READ','IDEMPOTENT_WRITE','NONIDEMPOTENT_WRITE'])}),
 getRuntimeTool:z.strictObject({...activation,stepNo:revision,toolCallId:opaqueKey}),
 markRuntimeToolSent:z.strictObject({...activation,operationId:ids.operation}),
 finishRuntimeTool:z.strictObject({...activation,operationId:ids.operation,resultMessageId:ids.message,failed:z.boolean()}),
 markRuntimeToolUnknown:z.strictObject({...activation,operationId:ids.operation,errorCode:opaqueKey}),
 recoverRuntimeActivations:z.strictObject({}),
 publishRuntimeResult:z.strictObject({...activation,stepNo:revision,contentHash:sha256,output:z.record(z.string(),z.json())}),
};
export type RuntimeMethod=keyof typeof runtimeRequests;
export type RuntimeInput<M extends RuntimeMethod>=z.output<(typeof runtimeRequests)[M]>;
export interface ExecutionHostView {principalId:string;runId:string;attemptId:string;activationId:string;grantId:string;sessionId:string|null;roleSnapshot:Record<string,unknown>;permit:Record<string,unknown>;inputManifest:Record<string,unknown>;inputFingerprint:string;work:Record<string,unknown>;requirements:Record<string,unknown>;taskSnapshot:Record<string,unknown>}
export interface RuntimeActivationView {activationId:string;sessionId:string;state:string;tokensUsed:number;tokenLimit:number;maxSteps:number;unknownUsage:boolean;configHash:string}
export interface RuntimeToolView {operationId:string;activationId:string;sessionId:string;stepNo:number;toolCallId:string;toolName:string;state:string;resultMessageId:string|null;argsHash:string;errorCode:string|null}
export interface RuntimeResults {
 getExecutionHost:ExecutionHostView;
 getAcceptedTaskSnapshot:Record<string,unknown>;
 reconcileRuntimeTask:{state:'RECONCILE'};
 beginRuntimeActivation:RuntimeActivationView;
 assertRuntimeActivation:RuntimeActivationView;
 accountRuntimeModel:RuntimeActivationView;
 markRuntimeModelSent:{state:'SENT'};
 setRuntimeState:RuntimeActivationView;
 prepareRuntimeTool:RuntimeToolView;
 getRuntimeTool:RuntimeToolView|null;
 markRuntimeToolSent:RuntimeToolView;
 finishRuntimeTool:RuntimeToolView;
 markRuntimeToolUnknown:RuntimeToolView;
 recoverRuntimeActivations:{activations:number;tools:number};
 publishRuntimeResult:{artifactId:string;sha256:string;schemaId:string};
}
