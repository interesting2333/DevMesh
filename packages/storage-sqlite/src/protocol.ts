import { z } from 'zod';
import type { planReviewView } from '@devmesh/contracts';
import { ids, revision, epoch, sha256, gitCommit, projectName, opaqueKey, inputManifest, planDraft, productOutput, attemptState, role, artifactRef, workflowOwner, workDelegation } from '@devmesh/contracts';
import { sessionRequests } from './session-protocol.js';
import type { SessionResults } from './session-protocol.js';
import { registryRequests } from './registry-protocol.js';
import type { RegistryResults } from './registry-protocol.js';
import type { EndpointConfig } from './registry-protocol.js';
import { runtimeRequests } from './runtime-protocol.js';
import type { RuntimeResults } from './runtime-protocol.js';
import { inputRequests } from './input-protocol.js';
import type { InputResults } from './input-protocol.js';
import { preparationRequests } from './preparation-protocol.js';
import type { PreparationResults } from './preparation-protocol.js';
import {toolRequests} from './tool-protocol.js';
import type {ToolResults} from './tool-protocol.js';
import {pipelineRequests} from './pipeline-protocol.js';
import type {PipelineResults} from './pipeline-protocol.js';
import {repoRequests} from './repo-protocol.js';
import type {RepoResults} from './repo-protocol.js';
import {workspaceRequests} from './workspace-protocol.js';
import type {WorkspaceResults} from './workspace-protocol.js';
import {repoFileRequests} from './repo-file-protocol.js';
import type {RepoFileResults} from './repo-file-protocol.js';
import {sourceArchiveRequests} from './source-archive-protocol.js';
import type {SourceArchiveResults} from './source-archive-protocol.js';
import {candidateRequests} from './candidate-protocol.js';
import type {CandidateResults} from './candidate-protocol.js';
import {candidateIntegrationRequests} from './candidate-integration-protocol.js';
import type {CandidateIntegrationResults} from './candidate-integration-protocol.js';
import {candidateMaterialRequests} from './candidate-material-protocol.js';
import type {CandidateMaterialResults} from './candidate-material-protocol.js';
import {workspacePreservationRequests} from './workspace-preservation-protocol.js';
import type {WorkspacePreservationResults} from './workspace-preservation-protocol.js';
import {workspaceMaintenanceRequests} from './workspace-maintenance-protocol.js';
import type {WorkspaceMaintenanceResults} from './workspace-maintenance-protocol.js';
import {workspaceReclamationRequests} from './workspace-reclamation-protocol.js';
import type {WorkspaceReclamationResults} from './workspace-reclamation-protocol.js';
import {qualityRequests} from './quality-protocol.js';
import type {QualityResults} from './quality-protocol.js';
import {workVerificationRequests} from './work-verification-protocol.js';
import type {WorkVerificationResults} from './work-verification-protocol.js';
import {verifiedFindingRequests} from './verified-finding-protocol.js';
import type {VerifiedFindingResults} from './verified-finding-protocol.js';
import {releaseFreezeRequests} from './release-freeze-protocol.js';
import type {ReleaseFreezeResults} from './release-freeze-protocol.js';
import {releaseDeliveryRequests} from './release-delivery-protocol.js';
import type {ReleaseDeliveryResults} from './release-delivery-protocol.js';
import {verifiedRepairRequests,verifiedRepairPublish} from './verified-repair-protocol.js';
import type {VerifiedRepairResults} from './verified-repair-protocol.js';

const meta = z.strictObject({ principalId: opaqueKey, scopeId: opaqueKey, idempotencyKey: z.uuid() });
const conditional = { meta, runId: ids.run, ifMatch: z.string().optional() };
const limit = z.number().int().min(1).max(200).default(50);
const roleSnapshot = z.strictObject({ role, revision: opaqueKey, provider: opaqueKey, model: opaqueKey, promptArtifactId: ids.artifact, outputSchemaId: opaqueKey, allowedTools: z.array(opaqueKey), maxSteps: revision, contextLimitTokens: revision, outputReserveTokens: revision, requestTimeoutMs: revision, maxReadOnlyRetries: epoch });
const endpointTarget=z.strictObject({endpointId:opaqueKey,revision,cardHash:sha256,registryGenerationId:opaqueKey});
const resources=z.array(z.strictObject({kind:z.enum(['snapshot','workspace','projectRepository','dataset']),resourceId:opaqueKey,access:z.enum(['read','write'])})).min(1).max(64);
const admissionWork=z.strictObject({workId:ids.work,workRevision:revision,workEpoch:epoch,inputManifest,roleSnapshot,endpoint:endpointTarget,resources});
const verificationOutputs=z.array(z.strictObject({slot:opaqueKey,ref:artifactRef})).max(64);
export const requests = {
  ...releaseFreezeRequests,
  ...releaseDeliveryRequests,
  ...verifiedRepairRequests,
  publishVerifiedRepair:verifiedRepairPublish,
  ...verifiedFindingRequests,
  ...workVerificationRequests,
  ...qualityRequests,
  ...workspaceMaintenanceRequests,
  ...workspaceReclamationRequests,
  ...workspacePreservationRequests,
  ...candidateMaterialRequests,
  ...candidateIntegrationRequests,
  ...candidateRequests,
  ...sourceArchiveRequests,
  ...repoFileRequests,
  ...workspaceRequests,
  ...repoRequests,
  ...pipelineRequests,
  ...toolRequests,
  ...preparationRequests,
  ...inputRequests,
  ...runtimeRequests,
  ...registryRequests,
  ...sessionRequests,
  registerContent: z.strictObject({ contentHash: sha256, byteSize: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), mimeType: z.string().min(1).max(128) }),
  createProjectWithRun: z.strictObject({ meta, projectId: ids.project.optional(), name: projectName, baseCommit: gitCommit, contentHash: sha256, kind: z.enum(['NEW', 'ITERATION', 'FIX']).default('NEW'), clientMessageId: z.uuid() }),
  publishPlan: z.strictObject({ ...conditional, requirementRevision: revision, planRevision: revision, requirements: productOutput, plan: planDraft, planContentHash: sha256 }),
  confirmPlan: z.strictObject({ ...conditional, planRevision: revision, requirementRevision: revision, reviewHash: sha256,carryForwardHash:sha256.optional() }),
  getPlanReview: z.strictObject({ principalId: opaqueKey, runId: ids.run, planRevision: revision.optional() }),
  confirmReviewedPlan: z.strictObject({ ...conditional, planRevision: revision, requirementRevision: revision, reviewHash: sha256,carryForwardHash:sha256.optional() }),
  admitWorks: z.strictObject({ ...conditional, runEpoch: epoch, planRevision: revision, works: z.array(admissionWork).min(1).max(2) }),
  nextScheduledWork:z.strictObject({limit:z.number().int().min(1).max(100).default(24)}),
  deferScheduledWork:z.strictObject({runId:ids.run,resourceRevision:revision}),
  admitScheduledWork:z.strictObject({...conditional,runEpoch:epoch,planRevision:revision,work:admissionWork.omit({inputManifest:true}),
    callerId:opaqueKey,runnerId:opaqueKey,reservationKey:opaqueKey,runnerCapacity:z.number().int().min(1).max(4),
    runnerLimits:z.strictObject({cpu:z.number().positive().max(64),memoryMiB:revision,timeoutMs:revision}),
    maximumAttempts:z.number().int().min(1).max(200),maximumReservedMs:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    templateVersion:opaqueKey,checkConfigHash:sha256}),
  recordVerifiedWork:z.strictObject({meta,runId:ids.run,attemptId:ids.attempt,outcome:z.enum(['success','completed-with-findings']),
    evidence:artifactRef,outputs:verificationOutputs,codeCommit:gitCommit.nullable(),verificationOperationId:ids.operation.optional()}),
  listScheduledDispatches:z.strictObject({limit:z.number().int().min(1).max(50).default(8)}),
  markScheduledDispatchSent:z.strictObject({attemptId:ids.attempt,callerId:opaqueKey}),
  reconcileScheduledDispatch:z.strictObject({attemptId:ids.attempt,callerId:opaqueKey}),
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
export interface Results extends SessionResults, RegistryResults, RuntimeResults, InputResults, PreparationResults, ToolResults, PipelineResults, RepoResults, WorkspaceResults, RepoFileResults, SourceArchiveResults, CandidateIntegrationResults, CandidateMaterialResults, WorkspacePreservationResults, WorkspaceReclamationResults, WorkspaceMaintenanceResults, CandidateResults, QualityResults, WorkVerificationResults, VerifiedFindingResults, VerifiedRepairResults, ReleaseDeliveryResults, ReleaseFreezeResults {
  registerContent: { contentHash: string; storageKey: string };
  createProjectWithRun: OperationResult;
  publishPlan: OperationResult;
  publishVerifiedRepair:OperationResult;
  confirmPlan: OperationResult;
  confirmReviewedPlan: OperationResult;
  getPlanReview: z.output<typeof planReviewView>;
  admitWorks: OperationResult;
  nextScheduledWork: ScheduledCandidate[];
  deferScheduledWork: {deferred:boolean};
  admitScheduledWork: OperationResult;
  recordVerifiedWork: OperationResult;
  listScheduledDispatches: ScheduledDispatch[];
  markScheduledDispatchSent: {send:boolean;state:string};
  reconcileScheduledDispatch:{state:string;taskId:string|null};
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
export interface ScheduledCandidate {
  projectId:string;runId:string;principalId:string;runEpoch:number;resourceRevision:number;planRevision:number;workEpoch:number;
  work: z.output<typeof planDraft>['works'][number];
}
export interface ScheduledDispatch {
  attemptId:string;callerId:string;endpoint:EndpointConfig;state:'PENDING'|'SENT'|'RECONCILE';
  delegation:z.output<typeof workDelegation>;
}
export type WorkflowOwner = z.infer<typeof workflowOwner>;
