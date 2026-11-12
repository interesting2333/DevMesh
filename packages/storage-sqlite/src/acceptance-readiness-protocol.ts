import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp,artifactRef} from '@devmesh/contracts';
import type {AcceptancePreparation} from './acceptance-protocol.js';

export const previewAcceptanceReleaseClaim=z.strictObject({schemaVersion:z.literal('devmesh.preview-release-claim.v1'),operationId:ids.operation,releaseId:ids.release,candidateId:ids.candidate,manifestHash:sha256,previewId:ids.preview,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),startOperationId:ids.operation,startRequestHash:sha256,instanceId:opaqueKey,acceptanceRequestHash:sha256});
export const acceptanceServiceClaim=z.strictObject({schemaVersion:z.literal('devmesh.acceptance-service-claim.v1'),purpose:z.literal('ACCEPTANCE'),operationId:ids.operation,acceptanceRequestHash:sha256,releaseId:ids.release,projectId:ids.project,runId:ids.run,candidateId:ids.candidate,manifestHash:sha256,reviewHash:sha256,dataPlanHash:sha256,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),reservationId:opaqueKey,profileHash:sha256,serviceRequestHash:sha256,instanceId:opaqueKey});
export const acceptanceReleaseClaim=z.discriminatedUnion('schemaVersion',[previewAcceptanceReleaseClaim,acceptanceServiceClaim]);
const heldFence=z.strictObject({kind:z.literal('DURABLE_WRITE_FENCE'),fenceId:opaqueKey,generation:z.number().int().positive().safe(),proofHash:sha256,heldAt:timestamp,state:z.literal('HELD')});
const endpoint=z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)});
/** Only a trusted adapter may construct this after querying its original objects. */
export const acceptancePreparedProof=z.strictObject({
  schemaVersion:z.literal('devmesh.acceptance-prepared.v1'),operationId:ids.operation,requestHash:sha256,
  releaseId:ids.release,projectId:ids.project,runId:ids.run,candidateId:ids.candidate,manifestHash:sha256,reviewHash:sha256,dataPlanHash:sha256,
  runnerId:opaqueKey,backendRef:opaqueKey,
  data:z.strictObject({datasetId:ids.dataset,storageKey:z.string().max(512),schemaRevision:opaqueKey,originDatasetId:ids.dataset.nullable(),sourceReleaseId:ids.release.nullable(),snapshotAt:timestamp,sha256,byteSize:z.number().int().positive().safe(),integrity:z.literal('ok'),journalHash:sha256,migrationRef:artifactRef.nullable()}),
  sourceFence:z.strictObject({datasetId:ids.dataset,datasetOperationId:ids.operation,closeOperationId:ids.operation,closeRequestHash:sha256,gateFence:z.number().int().positive().safe(),physical:heldFence}).nullable(),
  targetFence:z.strictObject({datasetId:ids.dataset,physical:heldFence,writeState:z.literal('CLOSED')}),
  service:z.strictObject({reservationId:opaqueKey,profileHash:sha256,endpoint,claim:acceptanceReleaseClaim,claimHash:sha256,custodyState:z.literal('RELEASE_HELD'),custodyRevision:z.number().int().nonnegative().safe()}),
  preparedAt:timestamp,
});
export const acceptancePreparationObservation=z.discriminatedUnion('state',[
  z.strictObject({state:z.literal('UNKNOWN'),errorCode:opaqueKey,checkedAt:timestamp}),
  z.strictObject({state:z.literal('READY'),proof:acceptancePreparedProof,fences:z.strictObject({sourceProofHash:sha256.nullable(),targetProofHash:sha256,state:z.literal('HELD'),writeState:z.literal('CLOSED')}),health:z.strictObject({instanceId:opaqueKey,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),endpoint,claimHash:sha256,custodyState:z.literal('RELEASE_HELD'),custodyRevision:z.number().int().nonnegative().safe(),state:z.literal('HEALTHY')}),checkedAt:timestamp}),
]);
const bound={principalId:opaqueKey,operationId:ids.operation,requestHash:sha256};
export const acceptanceReadinessRequests={
  verifyAcceptancePreparation:z.strictObject(bound),
  getAcceptanceReadiness:z.strictObject(bound),
  recordAcceptancePreparationObservation:z.strictObject({...bound,expectedPreparationRevision:z.number().int().nonnegative().safe(),expectedSequence:z.number().int().nonnegative().safe(),observation:acceptancePreparationObservation}),
  listAcceptancePreparationObservations:z.strictObject({...bound,afterSequence:z.number().int().nonnegative().safe().default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type AcceptancePreparedProof=z.output<typeof acceptancePreparedProof>;
export type AcceptancePreparationObservation=z.output<typeof acceptancePreparationObservation>;
export type AcceptanceReadinessMethod=keyof typeof acceptanceReadinessRequests;
export type AcceptanceReadinessInput<M extends AcceptanceReadinessMethod>=z.output<(typeof acceptanceReadinessRequests)[M]>;
export interface AcceptanceReadiness {
  operationId:string;requestHash:string;sequence:number;state:'UNPREPARED'|'READY'|'UNAVAILABLE'|'STALE';reasonCode:string|null;
  proofHash:string|null;proof:AcceptancePreparedProof|null;observation:AcceptancePreparationObservation|null;
}
export interface AcceptancePreparationBackend {
  readonly configured:boolean;
  preflight(preparation:AcceptancePreparation):Promise<void>;
  prepare(preparation:AcceptancePreparation,authorize:()=>Promise<boolean>):Promise<AcceptancePreparationObservation>;
  inspect(preparation:AcceptancePreparation):Promise<AcceptancePreparationObservation>;
}
export interface AcceptanceReadinessResults {
  verifyAcceptancePreparation:{allowed:boolean;reasonCode:string|null};
  getAcceptanceReadiness:AcceptanceReadiness;
  recordAcceptancePreparationObservation:AcceptanceReadiness;
  listAcceptancePreparationObservations:{items:{sequence:number;observation:AcceptancePreparationObservation;observedAt:string}[];nextSequence:number|null};
}
