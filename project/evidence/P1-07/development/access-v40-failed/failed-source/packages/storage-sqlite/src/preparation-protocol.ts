import { z } from 'zod';
import {ids,opaqueKey,sha256,revision,epoch,relativeFile,answerQuestionsInput,preparationProfile,preparationDelegation,understandingView} from '@devmesh/contracts';
import type {OperationResult} from './protocol.js';
const principal={principalId:opaqueKey};
const meta=z.strictObject({...principal,scopeId:opaqueKey,idempotencyKey:z.uuid()});
const target={...principal,runId:ids.run};
const claim={preparationAttemptId:opaqueKey,workerId:opaqueKey,claimToken:opaqueKey};
const json=z.record(z.string(),z.json());
export const preparationRequests={
  ensurePreparationJob:z.strictObject({...target,processingOperationId:ids.operation}),
  getPreparationJob:z.strictObject({...principal,jobId:ids.job}),
  getUnderstanding:z.strictObject({...target,requirementRevision:revision.optional()}),
  answerPreparationQuestions:z.strictObject({meta,runId:ids.run,ifMatch:z.string().optional(),body:answerQuestionsInput}),
  retryPreparationInterpretation:z.strictObject({meta,runId:ids.run,ifMatch:z.string().optional(),failedInterpretationOperationId:ids.operation}),
  listPreparationJobs:z.strictObject({limit:z.number().int().min(1).max(100).default(20)}),
  failUnreservedPreparation:z.strictObject({...principal,jobId:ids.job,errorCode:z.enum(['BASIS_SUPERSEDED','PREPARATION_INPUT_LIMIT','CONTENT_UNAVAILABLE','PREPARATION_GIT_SOURCE_INVALID','PREPARATION_BUDGET_EXHAUSTED'])}),
  getPreparationContext:z.strictObject({...principal,jobId:ids.job}),
  registerPreparationBootstrap:z.strictObject({...principal,jobId:ids.job,path:relativeFile,contentHash:sha256}),
  reservePreparation:z.strictObject({...principal,jobId:ids.job,basisHash:sha256,profile:preparationProfile,profileHash:sha256,inputHash:sha256,callerId:opaqueKey,endpointId:opaqueKey,endpointRevision:revision,registryGenerationId:opaqueKey,projectionRevision:epoch}),
  markPreparationDispatchSent:z.strictObject({preparationAttemptId:opaqueKey}),
  lookupPreparationDispatch:z.strictObject({preparationAttemptId:opaqueKey}),
  reconcilePreparationDispatch:z.strictObject({preparationAttemptId:opaqueKey}),
  acceptPreparationTask:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,endpointRevision:revision,delegation:preparationDelegation,message:json,registryGenerationId:opaqueKey,projectionRevision:epoch}),
  getPreparationTask:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,taskId:opaqueKey}),
  listPreparationTasks:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,afterId:opaqueKey.optional(),limit:z.number().int().min(1).max(100).default(50)}),
  listPreparationTaskEvents:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,taskId:opaqueKey,afterSeq:epoch.default(0)}),
  cancelPreparationTask:z.strictObject({callerId:opaqueKey,endpointId:opaqueKey,taskId:opaqueKey}),
  claimPreparationTasks:z.strictObject({endpointId:opaqueKey,workerId:opaqueKey,limit:z.number().int().min(1).max(2).default(1)}),
  getPreparationHost:z.strictObject(claim),
  preparePreparationStep:z.strictObject({...claim,requestHash:sha256,reservedTokens:z.number().int().positive()}),
  markPreparationSent:z.strictObject(claim),
  savePreparationResponse:z.strictObject({...claim,responseHash:sha256,providerRequestId:z.string().min(1).max(512),usage:z.strictObject({inputTokens:z.number().int().nonnegative(),outputTokens:z.number().int().nonnegative(),source:z.enum(['provider','estimated'])})}),
  failPreparation:z.strictObject({...claim,errorCode:opaqueKey,unknown:z.boolean(),knownFailure:z.boolean().default(false)}),
  applyPreparationResponse:z.strictObject({...claim,outputHash:sha256,output:json,planContentHash:sha256.optional()}),
  recoverPreparations:z.strictObject({}),
};
export type PreparationMethod=keyof typeof preparationRequests;
export type PreparationParsed<M extends PreparationMethod>=z.output<(typeof preparationRequests)[M]>;
export interface PreparationJob {
  jobId:string;runId:string;operationId:string;principalId:string;purpose:string;role:'product'|'architect';state:string;
  basisHash:string|null;basis:Record<string,unknown>|null;retryOf:string|null;errorCode:string|null;resultArtifactId:string|null;
}
export type UnderstandingView=z.output<typeof understandingView>;
export interface PreparationContext {
  job:PreparationJob;basisHash:string;basis:Record<string,unknown>;baseCommit:string;requirementRevision:number|null;
  sources:{ref:Record<string,unknown>;contentHash:string;byteSize:number;label:string}[];
  requirements:Record<string,unknown>|null;answers:{answerId:string;questionId:string;questionRevision:number;value:unknown}[];
}
export interface PreparationAttempt {preparationAttemptId:string;jobId:string;runId:string;state:string;delegation:Record<string,unknown>;endpointId:string;endpointRevision:number;callerId:string;dispatchSent:boolean}
export interface PreparationTask {endpointId:string;taskId:string;contextId:string;state:string;revision:number;snapshot:Record<string,unknown>}
export interface PreparationClaim {preparationAttemptId:string;workerId:string;claimToken:string}
export interface PreparationHost {claim:PreparationClaim;attempt:PreparationAttempt;job:PreparationJob;principalId:string;profile:Record<string,unknown>;profileHash:string;inputHash:string;requestHash:string|null;responseHash:string|null;stepState:string|null}
export interface PreparationResults {
  ensurePreparationJob:PreparationJob;getPreparationJob:PreparationJob;getUnderstanding:UnderstandingView;
  answerPreparationQuestions:OperationResult;retryPreparationInterpretation:OperationResult;
  listPreparationJobs:PreparationJob[];getPreparationContext:PreparationContext;reservePreparation:PreparationAttempt;
  failUnreservedPreparation:{closed:boolean};
  registerPreparationBootstrap:{artifactId:string;sha256:string};
  markPreparationDispatchSent:PreparationAttempt;lookupPreparationDispatch:PreparationTask|null;reconcilePreparationDispatch:PreparationTask|null;
  acceptPreparationTask:PreparationTask;getPreparationTask:PreparationTask;
  listPreparationTasks:{tasks:PreparationTask[];nextPageToken:string;totalSize:number};listPreparationTaskEvents:{seq:number;snapshot:Record<string,unknown>}[];
  cancelPreparationTask:PreparationTask;claimPreparationTasks:PreparationClaim[];getPreparationHost:PreparationHost;
  preparePreparationStep:{state:string};markPreparationSent:{state:string};savePreparationResponse:{state:string};
  failPreparation:{state:string};applyPreparationResponse:{artifactId:string;sha256:string;requirementRevision?:number;planRevision?:number};
  recoverPreparations:{unresolved:number;notSent:number};
}
