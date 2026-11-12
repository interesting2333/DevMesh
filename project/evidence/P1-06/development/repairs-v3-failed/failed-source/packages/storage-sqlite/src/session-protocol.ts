import { z } from 'zod';
import { ids, sha256, revision, epoch, opaqueKey } from '@devmesh/contracts';
import {candidateMaterialTarget} from './candidate-material-protocol.js';
import {workspacePreservationTarget} from './workspace-preservation-protocol.js';
import {qualityMaterialTarget} from './quality-protocol.js';
import {workVerificationTarget} from './work-verification-protocol.js';
import {verifiedRepairTarget} from './verified-repair-protocol.js';

const meta = z.strictObject({ principalId: opaqueKey, scopeId: opaqueKey, idempotencyKey: z.uuid() });
const messageKind = z.enum(['user','assistant','tool-call','tool-result','context-summary']);
const page = { afterSeq: epoch.default(0), limit: z.number().int().min(1).max(200).default(50) };
export const messageRef = z.strictObject({ messageId: ids.message, seq: revision, sha256 });
export const contextManifest = z.strictObject({ schemaVersion: z.literal('devmesh.context.v1'), sessionId: ids.session, roleSnapshotId: ids.roleSnapshot, throughMessageSeq: epoch, configHash: sha256, messages: z.array(messageRef).max(200), summaryContentHash: sha256.optional() });
export const objectTarget = z.discriminatedUnion('kind', [
  z.strictObject({kind:z.literal('verifiedRepair'),...verifiedRepairTarget}),
  z.strictObject({kind:z.literal('workVerification'),...workVerificationTarget}),
  z.strictObject({kind:z.literal('qualityMaterial'),...qualityMaterialTarget}),
  z.strictObject({kind:z.literal('workspacePreservation'),...workspacePreservationTarget}),
  z.strictObject({kind:z.literal('candidateMaterial'),...candidateMaterialTarget}),
  z.strictObject({ kind: z.literal('content') }),
  z.strictObject({ kind: z.literal('attachment'), clientAttachmentId: z.uuid(), name: z.string().min(1).max(255) }),
  z.strictObject({ kind: z.literal('message'), sessionId: ids.session, clientMessageId: opaqueKey, activationId: ids.activation, stepNo: revision.optional(), messageKind, toolCallId: opaqueKey.optional(), sourceRef: z.strictObject({ messageId: ids.message }).optional() }),
  z.strictObject({ kind: z.literal('context'), manifest: contextManifest }),
  z.strictObject({ kind: z.literal('modelRequest'), sessionId: ids.session, stepNo: revision, contextSnapshotId: opaqueKey, configHash: sha256 }),
  z.strictObject({ kind: z.literal('modelResponse'), sessionId: ids.session, stepNo: revision, activationId: ids.activation, state: z.enum(['RESPONDED','INTERRUPTED','FAILED']), providerRequestId: z.string().min(1).max(512).optional(), usage: z.strictObject({ inputTokens: epoch, outputTokens: epoch, source: z.enum(['provider','estimated']) }).optional() }),
]);
export const contentReference = z.discriminatedUnion('kind', [
  z.strictObject({kind:z.literal('verifiedRepair'),...verifiedRepairTarget}),
  z.strictObject({kind:z.literal('workVerification'),...workVerificationTarget}),
  z.strictObject({kind:z.literal('qualityMaterial'),...qualityMaterialTarget}),
  z.strictObject({kind:z.literal('workspacePreservation'),...workspacePreservationTarget}),
  z.strictObject({kind:z.literal('candidateMaterial'),...candidateMaterialTarget}),
  z.strictObject({ kind: z.literal('attachment'), attachmentId: ids.attachment }),
  z.strictObject({ kind: z.literal('message'), messageId: ids.message }),
  z.strictObject({ kind: z.literal('inputMessage'), messageId: ids.message }),
  z.strictObject({ kind: z.literal('preparationInput'), preparationAttemptId: opaqueKey }),
  z.strictObject({ kind: z.literal('preparationResponse'), preparationAttemptId: opaqueKey }),
  z.strictObject({ kind: z.literal('artifact'), artifactId: ids.artifact }),
  z.strictObject({ kind: z.literal('context'), contextSnapshotId: opaqueKey }),
  z.strictObject({ kind: z.literal('modelRequest'), sessionId: ids.session, stepNo: revision }),
  z.strictObject({ kind: z.literal('modelResponse'), sessionId: ids.session, stepNo: revision }),
]);
export const sessionRequests = {
  beginObjectWrite: z.strictObject({ meta, expectedHash: sha256, expectedSize: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), mimeType: z.string().min(1).max(128), target: objectTarget }),
  getObjectWrite: z.strictObject({ principalId: opaqueKey, writeId: opaqueKey }),
  sealObjectWrite: z.strictObject({ principalId: opaqueKey, writeId: opaqueKey }),
  commitObjectWrite: z.strictObject({ principalId: opaqueKey, writeId: opaqueKey }),
  failObjectWrite: z.strictObject({ principalId: opaqueKey, writeId: opaqueKey, error: z.string().min(1).max(2000) }),
  scanObjectWrites: z.strictObject({ afterWriteId: z.string().default(''), limit: page.limit }),
  ensureSession: z.strictObject({ principalId: opaqueKey, runId: ids.run, attemptId: ids.attempt }),
  getSession: z.strictObject({ principalId: opaqueKey, sessionId: ids.session }),
  closeSession: z.strictObject({ principalId: opaqueKey, sessionId: ids.session }),
  listSessionMessages: z.strictObject({ principalId: opaqueKey, sessionId: ids.session, ...page }),
  getModelStep: z.strictObject({ principalId: opaqueKey, sessionId: ids.session, stepNo: revision }),
  markModelStepSent: z.strictObject({ principalId: opaqueKey, sessionId: ids.session, stepNo: revision }),
  resolveContentRead: z.strictObject({ principalId: opaqueKey, reference: contentReference }),
  releaseContentRead: z.strictObject({ principalId: opaqueKey, pinId: opaqueKey }),
  recoverContentReads: z.strictObject({}),
  listContentObjects: z.strictObject({ afterHash: z.string().default(''), limit: page.limit }),
  markContentMissing: z.strictObject({ contentHash: sha256, error: z.string().min(1).max(2000) }),
  beginContentDeletion: z.strictObject({ contentHash: sha256 }),
  finishContentDeletion: z.strictObject({ contentHash: sha256 }),
};
export type ObjectTarget = z.input<typeof objectTarget>;
export type ContentReference = z.input<typeof contentReference>;
export type ContextManifest = z.input<typeof contextManifest>;
export interface ContentInfo { contentHash: string; byteSize: number; mimeType: string; storageKey: string; state: string }
export interface ObjectWrite { writeId: string; operationId: string; ownerId: string; expectedHash: string; expectedSize: number; mimeType: string; target: z.output<typeof objectTarget>; stagingKey: string; state: string; result: Record<string, unknown> | null }
export interface SessionInfo { sessionId: string; runId: string; attemptId: string; roleSnapshotId: string; lastMessageSeq: number; lastStepNo: number; status: string }
export interface SessionMessage { messageId: string; seq: number; sessionId: string; activationId: string; stepNo: number | null; kind: string; contentHash: string; toolCallId: string | null; sourceRef: unknown; createdAt: string }
export interface ModelStep { sessionId: string; stepNo: number; state: string; requestHash: string; responseHash: string | null; contextSnapshotId: string; usage: unknown; providerRequestId: string | null }
export interface SessionResults {
  beginObjectWrite: ObjectWrite; getObjectWrite: ObjectWrite; sealObjectWrite: ObjectWrite; commitObjectWrite: ObjectWrite; failObjectWrite: ObjectWrite; scanObjectWrites: ObjectWrite[];
  ensureSession: SessionInfo; getSession: SessionInfo; closeSession: SessionInfo;
  listSessionMessages: { messages: SessionMessage[]; nextCursor: number };
  getModelStep: ModelStep; markModelStepSent: ModelStep;
  resolveContentRead: ContentInfo & { pinId: string }; releaseContentRead: { released: boolean }; recoverContentReads: { released: number };
  listContentObjects: ContentInfo[]; markContentMissing: { contentHash: string; state: string };
  beginContentDeletion: ContentInfo; finishContentDeletion: { contentHash: string; deleted: boolean };
}
export type SessionMethod = keyof typeof sessionRequests;
export type SessionInput<M extends SessionMethod> = z.output<(typeof sessionRequests)[M]>;
