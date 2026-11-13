import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {acceptanceAbortDecision} from './acceptance-abort-protocol.js';
import {acceptancePreparedProof} from './acceptance-readiness-protocol.js';

// Shared wire facts. Storage never imports a Runner implementation or trusts a
// browser-supplied cleanup flag. Only the original configured backend may submit.
export const acceptanceDatasetFences=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-fences.v1'),operationId:ids.operation,requestHash:sha256,sourceFence:acceptancePreparedProof.shape.sourceFence,targetFence:acceptancePreparedProof.shape.targetFence});
export const acceptanceDatasetAbortRequest=z.strictObject({schemaVersion:z.literal('devmesh.acceptance-dataset-abort.v1'),decision:acceptanceAbortDecision,decisionHash:sha256,controllerId:opaqueKey,serviceCleanupHash:sha256});
export const acceptanceAbortFenceSuccessor=z.strictObject({fenceId:opaqueKey,generation:z.number().int().positive().safe(),proofHash:sha256,previousHoldHash:sha256.nullable()});
export const acceptanceDatasetAbortProof=z.strictObject({
 schemaVersion:z.literal('devmesh.acceptance-dataset-aborted.v1'),operationId:ids.operation,abortOperationId:ids.operation,decisionHash:sha256,requestHash:sha256,
 originalFences:acceptanceDatasetFences.nullable(),
 revocation:z.strictObject({barrierId:opaqueKey,generation:z.number().int().positive().safe(),proofHash:sha256,state:z.literal('PERMANENTLY_REVOKED')}),
 target:acceptanceAbortFenceSuccessor.extend({datasetId:ids.dataset,writeState:z.literal('CLOSED')}),
 source:acceptanceAbortFenceSuccessor.extend({releaseId:ids.release,datasetId:ids.dataset,datasetOperationId:ids.operation,owner:z.literal('ORIGINAL_RELEASE'),writeState:z.literal('CONTROL_CLOSED')}).nullable(),settledAt:timestamp,
});
export const acceptanceDatasetAbortReceipt=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-abort-receipt.v1'),requestHash:sha256,journalHash:sha256,proof:acceptanceDatasetAbortProof});
export const acceptanceAbortSourceGate=z.strictObject({datasetId:ids.dataset,datasetOperationId:ids.operation,datasetRequestHash:sha256,state:z.enum(['OPEN','CLOSED']),fence:z.number().int().nonnegative().safe(),revision:z.number().int().nonnegative().safe(),closeOperationId:ids.operation.nullable(),closeRequestHash:sha256.nullable()});
export const acceptanceAbortSourceRecovery=z.strictObject({
 schemaVersion:z.literal('devmesh.acceptance-abort-source-recovery.v1'),decisionHash:sha256,releaseId:ids.release,datasetId:ids.dataset,datasetOperationId:ids.operation,runnerId:opaqueKey,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),
 instanceId:opaqueKey,profileHash:sha256,serviceRequestHash:sha256,endpoint:z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)}),
 fence:acceptanceAbortFenceSuccessor,revocationProofHash:sha256,custodyState:z.literal('RELEASE_OWNED'),accessMode:z.literal('READ_WRITE'),state:z.literal('HEALTHY'),checkedAt:timestamp,
});
export const acceptanceAbortCompletionEvidence=z.strictObject({
 schemaVersion:z.literal('devmesh.acceptance-abort-completion.v1'),operationId:ids.operation,requestHash:sha256,decisionHash:sha256,
 service:z.strictObject({controllerId:opaqueKey,cleanupHash:sha256,reservationId:opaqueKey.nullable(),profileHash:sha256.nullable(),instanceId:opaqueKey.nullable(),networkId:opaqueKey.nullable(),state:z.literal('CLEARED')}),
 data:acceptanceDatasetAbortReceipt,sourceGate:acceptanceAbortSourceGate.nullable(),sourceRecovery:acceptanceAbortSourceRecovery.nullable(),
});
const bound={principalId:opaqueKey,preparationOperationId:ids.operation,requestHash:sha256,decisionHash:sha256};
export const acceptanceAbortRecoveryRequests={
 getAcceptanceAbortRecovery:z.strictObject(bound),
 completeAcceptanceAbort:z.strictObject({...bound,evidence:acceptanceAbortCompletionEvidence}),
};
export type AcceptanceAbortCompletionEvidence=z.output<typeof acceptanceAbortCompletionEvidence>;
export interface AcceptanceAbortCompletion {evidence:AcceptanceAbortCompletionEvidence;evidenceHash:string;completedAt:string}
export type AcceptanceAbortFinalization={state:'ABORTED';completion:AcceptanceAbortCompletion}|{state:'UNKNOWN';errorCode:string};
/** Trusted executable composition only. Implementations must honor stop before
 * new stages and drain active external calls before resolving advance. */
export interface AcceptanceAbortRecoveryBackend {
 readonly configured:boolean;
 advance(input:{operationId:string;requestHash:string},signal?:AbortSignal):Promise<AcceptanceAbortFinalization>;
}
export type AcceptanceAbortRecoveryMethod=keyof typeof acceptanceAbortRecoveryRequests;
export type AcceptanceAbortRecoveryInput<M extends AcceptanceAbortRecoveryMethod>=z.output<(typeof acceptanceAbortRecoveryRequests)[M]>;
export interface AcceptanceAbortRecoveryResults {
 getAcceptanceAbortRecovery:{completion:AcceptanceAbortCompletion|null;sourceGate:z.output<typeof acceptanceAbortSourceGate>|null;sourceImageDigest:string|null};
 completeAcceptanceAbort:AcceptanceAbortCompletion;
}
