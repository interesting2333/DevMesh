import { z } from 'zod';
import { ids, opaqueKey, sha256, gitCommit, epoch, projectName, createTaskInput, saveMessageInput, attachmentIds, attachmentName,sourceRef,requirement } from '@devmesh/contracts';
import type { OperationResult, RunView } from './protocol.js';
const principal = { principalId: opaqueKey };
const meta = z.strictObject({ ...principal, scopeId: opaqueKey, idempotencyKey: z.uuid() });
const page = { limit:z.number().int().min(1).max(200).default(50) };
const claim = { ...principal, intakeId: opaqueKey, claimToken: z.uuid() };
export const inputRequests = {
  checkInputAccess:z.strictObject({...principal,projectId:ids.project.optional(),runId:ids.run.optional(),write:z.boolean().default(false)}).refine(v=>(v.projectId!==undefined)!==(v.runId!==undefined),'Exactly one target is required'),
  createInputProject: z.strictObject({ meta, name:projectName, baseCommit:gitCommit, bodyHash:sha256, attachmentIds, clientDraftId:z.uuid() }),
  createInputTask: z.strictObject({ meta, projectId:ids.project, ifMatch:z.string().optional(), bodyHash:sha256, body:createTaskInput }),
  appendInputMessage: z.strictObject({ meta, runId:ids.run, ifMatch:z.string().optional(), bodyHash:sha256, body:saveMessageInput }),
  getInputOperation: z.strictObject({ ...principal, operationId:ids.operation }),
  lookupInputOperation: z.strictObject({ ...principal, scopeId:opaqueKey, idempotencyKey:z.uuid() }),
  getInputWorkspace: z.strictObject({ ...principal, projectId:ids.project, runId:ids.run.optional(), afterMessageId:z.string().max(256).optional(), ...page }),
  getWorkbenchSource:z.strictObject({...principal,runId:ids.run,ref:sourceRef}),
  listInputProjects: z.strictObject({ ...principal, cursor:z.strictObject({ updatedAt:z.iso.datetime({precision:3}), projectId:ids.project }).optional(), limit:z.number().int().min(1).max(100).default(20) }),
  getInputEventWindow: z.strictObject({ ...principal, projectId:ids.project, runId:ids.run, afterSeq:epoch.default(0), ...page }),
  listInputEvents: z.strictObject({ ...principal, projectId:ids.project, runId:ids.run, afterSeq:epoch.default(0), ...page }),
  getInputAttachment: z.strictObject({ ...principal, attachmentId:ids.attachment }),
  removeInputAttachment: z.strictObject({ ...principal, attachmentId:ids.attachment }),
  claimUploadIntake: z.strictObject({ meta, claimToken:z.uuid() }),
  getUploadIntake: z.strictObject({ ...principal, intakeId:opaqueKey }),
  validateUploadIntake: z.strictObject({ ...claim, requestHash:sha256, contentHash:sha256, byteSize:z.number().int().min(1).max(2097152), name:attachmentName, clientAttachmentId:z.uuid() }),
  commitUploadIntake: z.strictObject({ ...claim, contentHash:sha256, attachmentId:ids.attachment }),
  failUploadIntake: z.strictObject({ ...claim, errorCode:opaqueKey }),
  recoverUploadIntakes: z.strictObject({}),
};
export type InputMethod=keyof typeof inputRequests;
export type InputParsed<M extends InputMethod>=z.output<(typeof inputRequests)[M]>;
export interface AttachmentView { attachmentId:string; clientAttachmentId:string; name:string; byteSize:number; state:string; createdAt:string }
export interface UploadIntake { intakeId:string; operationId:string; state:string; stagingKey:string; requestHash:string|null; attachmentId:string|null; errorCode:string|null; claimed:boolean }
export interface WorkspaceView {
  project:{projectId:string;name:string;revision:number;acceptedReleaseId:string|null}; run:RunView;
  mode:'current'|'history'; membership:'owner'|'operator'|'viewer'; allowedActions:('saveMessage'|'createTask'|'answerQuestions')[]; eventCursor:number;
  preparation:{understandingAvailable:boolean;requiredOpenQuestions:number;pending:boolean};
  messages:{messageId:string;author:string;bodyArtifactId:string;clientMessageId:string;createdAt:string;attachmentIds:string[];intentHint:'query'|'change'|'unsure'|null}[];
  nextMessageCursor:string|null;
}
export interface InputResults {
  getWorkbenchSource:{projectId:string;runId:string;artifactId:string;contentHash:string;label:string;requirement:null}|{projectId:string;runId:string;artifactId:null;contentHash:null;label:string;requirement:z.output<typeof requirement>};
  checkInputAccess:{projectId:string;membership:string};
  createInputProject:OperationResult; createInputTask:OperationResult; appendInputMessage:OperationResult;
  getInputOperation:OperationResult; lookupInputOperation:OperationResult|null;
  getInputWorkspace:WorkspaceView;
  listInputProjects:{projects:{projectId:string;name:string;updatedAt:string;membership:string}[];nextCursor:{updatedAt:string;projectId:string}|null};
  getInputEventWindow:{events:Record<string,unknown>[];nextCursor:number;headSeq:number;retainedFromSeq:number};
  listInputEvents:{events:Record<string,unknown>[];nextCursor:number};
  getInputAttachment:AttachmentView; removeInputAttachment:AttachmentView;
  claimUploadIntake:UploadIntake;getUploadIntake:UploadIntake;validateUploadIntake:UploadIntake;commitUploadIntake:UploadIntake;failUploadIntake:UploadIntake;
  recoverUploadIntakes:{interrupted:number};
}
