import { z } from 'zod';
import { ids, revision, epoch, sha256, gitCommit, projectName, opaqueKey, inputManifest, planDraft, productOutput, attemptState, role, artifactRef, workflowOwner } from '@devmesh/contracts';
import { sessionRequests } from './session-protocol.js';
import type { SessionResults } from './session-protocol.js';
import { registryRequests } from './registry-protocol.js';
import type { RegistryResults } from './registry-protocol.js';
import { runtimeRequests } from './runtime-protocol.js';
import type { RuntimeResults } from './runtime-protocol.js';
import { inputRequests } from './input-protocol.js';
import type { InputResults } from './input-protocol.js';
import { preparationRequests } from './preparation-protocol.js';
import type { PreparationResults } from './preparation-protocol.js';

const meta = z.strictObject({ principalId: opaqueKey, scopeId: opaqueKey, idempotencyKey: z.uuid() });
const conditional = { meta, runId: ids.run, ifMatch: z.string().optional() };
const limit = z.number().int().min(1).max(200).default(50);
const roleSnapshot = z.strictObject({ role, revision: opaqueKey, provider: opaqueKey, model: opaqueKey, promptArtifactId: ids.artifact, outputSchemaId: opaqueKey, allowedTools: z.array(opaqueKey), maxSteps: revision, contextLimitTokens: revision, outputReserveTokens: revision, requestTimeoutMs: revision, maxReadOnlyRetries: epoch });
export const requests = {
  ...preparationRequests,
  ...inputRequests,
  ...runtimeRequests,
  ...registryRequests,
  ...sessionRequests,
  registerContent: z.strictObject({ contentHash: sha256, byteSize: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), mimeType: z.string().min(1).max(128) }),
  createProjectWithRun: z.strictObject({ meta, projectId: ids.project.optional(), name: projectName, baseCommit: gitCommit, contentHash: sha256, kind: z.enum(['NEW', 'ITERATION', 'FIX']).default('NEW'), clientMessageId: z.uuid() }),
  publishPlan: z.strictObject({ ...conditional, requirementRevision: revision, planRevision: revision, requirements: productOutput, plan: planDraft, planContentHash: sha256 }),
  confirmPlan: z.strictObject({ ...conditional, planRevision: revision, requirementRevision: revision, reviewHash: sha256 }),
  admitWorks: z.strictObject({ ...conditional, runEpoch: epoch, planRevision: revision, works: z.array(z.strictObject({
    workId: ids.work, workRevision: revision, workEpoch: epoch, inputManifest, roleSnapshot,
    endpoint: z.strictObject({ endpointId: opaqueKey, revision, cardHash: sha256, registryGenerationId: opaqueKey }),
    resources: z.array(z.strictObject({ kind: z.enum(['snapshot','workspace','projectRepository','dataset']), resourceId: opaqueKey, access: z.enum(['read','write']) })).min(1).max(64),
  })).min(1).max(2) }),
  transitionAttempt: z.strictObject({ meta, runId: ids.run, attemptId: ids.attempt, expectedState: attemptState, state: attemptState, evidenceRef: artifactRef.optional() }),
  setControlIntent: z.strictObject({ ...conditional, action: z.enum(['pause', 'cancel']) }),
  finishRun: z.strictObject({ ...conditional, outcome: z.enum(['FAILED', 'CANCELLED']), reason: z.string().min(1).max(2000) }),
  lookupOperation: z.strictObject({ principalId: opaqueKey, scopeId: opaqueKey, idempotencyKey: z.uuid() }),
  getOperation: z.strictObject({ operationId: ids.operation }),
  getRun: z.strictObject({ runId: ids.run }),
  getAttempt: z.strictObject({ attemptId: ids.attempt }),
  listEvents: z.strictObject({ runId: ids.run, afterSeq: epoch.default(0), limit }),
  claimOutbox: z.strictObject({ workerId: opaqueKey, limit, leaseMs: z.number().int().min(100).max(30000).default(5000) }),
  settleOutbox: z.strictObject({ outboxId: opaqueKey, workerId: opaqueKey, deliveryAttempt: revision, outcome: z.enum(['ACKED','RECONCILE']) }),
  inspect: z.strictObject({}),
};
export type Method = keyof typeof requests;
export type Request<M extends Method> = z.input<(typeof requests)[M]>;
export type OperationResult = { operationId: string; status: string; result: Record<string, unknown> | null };
export type RunView = { runId: string; projectId: string; taskId: string; resourceRevision: number; runEpoch: number; controlRevision: number; phase: string; controlGate: string; terminalOutcome: string | null; currentPlanRevision: number | null; currentRequirementRevision: number | null; eventSeq: number };
export type AttemptView = { attemptId: string; runId: string; workId: string; role: string; state: string; attemptNo: number; dispatchOperationId: string; endedAt: string | null };
export type OutboxView = { outboxId: string; operationId: string; destination: string; payload: Record<string, unknown>; status: string; deliveryAttempt: number; leaseOwner: string | null; leaseUntil: string | null };
export interface Results extends SessionResults, RegistryResults, RuntimeResults, InputResults, PreparationResults {
  registerContent: { contentHash: string; storageKey: string };
  createProjectWithRun: OperationResult;
  publishPlan: OperationResult;
  confirmPlan: OperationResult;
  admitWorks: OperationResult;
  transitionAttempt: OperationResult;
  setControlIntent: OperationResult;
  finishRun: OperationResult;
  lookupOperation: OperationResult | null;
  getOperation: OperationResult;
  getRun: RunView;
  getAttempt: AttemptView;
  listEvents: { events: Record<string, unknown>[]; nextCursor: number };
  claimOutbox: OutboxView[];
  settleOutbox: OutboxView;
  inspect: { version: number; storeId: string; layoutVersion: number; sqliteVersion: string; workerThreadId: number; pragmas: Record<string, unknown>; counts: Record<string, number>; backupPath: string | null; foreignKeyErrors: unknown[] };
}
export type Meta = z.output<typeof meta>;
export type Parsed<M extends Method> = z.output<(typeof requests)[M]>;
export type WorkflowOwner = z.infer<typeof workflowOwner>;
