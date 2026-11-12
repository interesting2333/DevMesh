import { z } from 'zod';
import { ids, inputText, taskTitle, projectName, opaqueKey, revision, epoch, timestamp, operationStatus } from './primitives.js';

export const inputLimits = Object.freeze({ textCodePoints: 20_000, attachments: 3, attachmentBytes: 2*1024*1024, jsonBytes: 256*1024 });
export const attachmentIds = z.array(ids.attachment).max(inputLimits.attachments).refine(v => new Set(v).size===v.length, 'Duplicate attachment IDs');
// Display names reject controls explicitly; they are never storage paths.
// eslint-disable-next-line no-control-regex
export const attachmentName = z.string().regex(/^[^\x00-\x1f\x7f/\\:]{1,80}$/u).refine(v => v.trim().length>0 && v!=='.' && v!=='..', 'Invalid display name');
export const initialInput = z.strictObject({ text: z.union([inputText,z.literal('')]), attachmentIds });
export const createProjectInput = z.strictObject({ initialRequest: initialInput, clientDraftId: z.uuid(), name: projectName.optional() }).refine(v => v.initialRequest.text.trim().length>0 || v.initialRequest.attachmentIds.length>0, 'Input requires text or an attachment');
export const createTaskInput = z.strictObject({ kind: z.enum(['ITERATION','FIX']), title: taskTitle, goal: initialInput, baseAcceptedReleaseId: ids.release, clientDraftId: z.uuid() }).refine(v => v.goal.text.trim().length>0 || v.goal.attachmentIds.length>0, 'Input requires text or an attachment');
export const saveMessageInput = z.strictObject({ text: inputText.refine(v=>v.trim().length>0,'Message cannot be blank'), attachmentIds, clientMessageId: z.uuid(), intentHint: z.enum(['query','change','unsure']).optional() });
export const uploadMetadata = z.strictObject({ clientAttachmentId: z.uuid(), name: attachmentName });
export const attachmentView = z.strictObject({ attachmentId: ids.attachment, clientAttachmentId: z.uuid(), name: attachmentName, byteSize: z.number().int().min(1).max(inputLimits.attachmentBytes), state: z.enum(['READY','REMOVED']), createdAt: timestamp });
export const inputOperation = z.strictObject({ operationId: ids.operation, status: operationStatus, result: z.record(z.string(),z.json()).nullable() });
export const workspaceView = z.strictObject({
  project: z.strictObject({ projectId: ids.project, name: projectName, revision, acceptedReleaseId: ids.release.nullable() }),
  run: z.strictObject({ runId: ids.run, projectId: ids.project, taskId: ids.userTask, resourceRevision: revision, runEpoch: revision, controlRevision: revision, phase: z.string(), controlGate: z.string(), terminalOutcome: z.string().nullable(), currentPlanRevision: revision.nullable(), currentRequirementRevision: revision.nullable(), eventSeq: epoch }),
  mode: z.enum(['current','history']), membership: z.enum(['owner','operator','viewer']), allowedActions: z.array(z.enum(['saveMessage','createTask','answerQuestions'])),
  preparation:z.strictObject({understandingAvailable:z.boolean(),requiredOpenQuestions:epoch,pending:z.boolean()}),
  eventCursor: epoch, messages: z.array(z.strictObject({ messageId: ids.message, author: opaqueKey, bodyArtifactId: ids.artifact, clientMessageId: z.string(), createdAt: timestamp, attachmentIds, intentHint: z.enum(['query','change','unsure']).nullable(), text:z.union([inputText,z.literal('')]) })).max(200),
  nextMessageCursor: z.string().nullable(),
  templateBaseline:z.strictObject({version:opaqueKey,baseCommit:z.string().regex(/^[a-f0-9]{40}$/)}),
});
