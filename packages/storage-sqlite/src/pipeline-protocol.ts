import {z} from 'zod';
import {executionPermit,ids,opaqueKey,pipelineDefinition,relativeFile,sha256} from '@devmesh/contracts';
const pipelineId=opaqueKey;
const ordinal=z.number().int().min(0).max(7);
const permit={permit:executionPermit};
export const pipelineJobFact=z.strictObject({jobId:ids.job,operationId:ids.operation,requestHash:sha256,request:z.record(z.string(),z.json()),
  state:z.enum(['QUEUED','STARTING','RUNNING','STOPPING','EXITED','OUTCOME_UNKNOWN']),exitCode:z.number().int().nullable(),errorCode:opaqueKey.nullable(),stopRequested:z.boolean(),logCursor:z.number().int().nonnegative(),
  outputRefs:z.array(z.strictObject({path:relativeFile,sha256,byteSize:z.number().int().nonnegative()})).max(33)});
export const pipelineRequests={
  createPipeline:z.strictObject({...permit,operationId:ids.operation,definition:pipelineDefinition,workspaceRef:opaqueKey}),
  getPipeline:z.strictObject({...permit,pipelineId}),
  getPipelineOperation:z.strictObject({...permit,operationId:ids.operation}),
  stopPipeline:z.strictObject({...permit,pipelineId}),
  listPipelineStages:z.strictObject({limit:z.number().int().min(1).max(40).default(20)}),
  markPipelineStageSent:z.strictObject({pipelineId,ordinal}),
  recordPipelineStage:z.strictObject({pipelineId,ordinal,job:pipelineJobFact}),
  markPipelineStageUnknown:z.strictObject({pipelineId,ordinal,errorCode:opaqueKey}),
};
export type PipelineMethod=keyof typeof pipelineRequests;
export type PipelineInput<M extends PipelineMethod>=z.output<(typeof pipelineRequests)[M]>;
export interface PipelineStageView {ordinal:number;stageId:string;operationId:string;state:string;jobId:string|null;exitCode:number|null;errorCode:string|null;logCursor:number;outputRefs:z.output<typeof pipelineJobFact>['outputRefs']}
export interface PipelineView {pipelineId:string;operationId:string;runId:string;attemptId:string;definitionId:string;definitionVersion:string;definitionHash:string;workspaceRef:string;state:string;stopRequested:boolean;stages:PipelineStageView[]}
export interface PipelineDispatch {pipelineId:string;ordinal:number;operationId:string;state:string;jobId:string|null;stopRequested:boolean;request:Record<string,unknown>|null}
export interface PipelineResults {
  createPipeline:PipelineView;getPipeline:PipelineView;getPipelineOperation:PipelineView;stopPipeline:PipelineView;
  listPipelineStages:PipelineDispatch[];
  markPipelineStageSent:{send:boolean;request:Record<string,unknown>|null};
  recordPipelineStage:PipelineView;markPipelineStageUnknown:PipelineView;
}
