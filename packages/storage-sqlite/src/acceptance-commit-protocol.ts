import {z} from 'zod';
import {ids,opaqueKey,sha256,revision} from '@devmesh/contracts';
import type {OperationResult} from './protocol.js';
import {acceptancePreparationRequest} from './acceptance-protocol.js';
import {acceptancePreparedProof} from './acceptance-readiness-protocol.js';

export const releasePromotionRequest=z.strictObject({
  schemaVersion:z.literal('devmesh.release-promotion.v1'),acceptanceOperationId:ids.operation,
  preparation:acceptancePreparationRequest,preparedProof:acceptancePreparedProof,proofHash:sha256,
});
export const acceptanceCommitRequests={
  commitReleaseAcceptance:z.strictObject({
    meta:z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()}),
    runId:ids.run,ifMatch:z.string().optional(),preparationOperationId:ids.operation,requestHash:sha256,
    expectedPreparationRevision:revision,expectedObservationSequence:revision,proofHash:sha256,
    candidateId:ids.candidate,candidateRevision:revision,manifestHash:sha256,reviewHash:sha256,
    expectedAcceptedReleaseId:ids.release.nullable(),dataPlanHash:sha256,confirmation:z.literal('ACCEPT_RELEASE'),
  }),
  getAcceptedRelease:z.strictObject({principalId:opaqueKey,releaseId:ids.release}),
};
export type AcceptanceCommitMethod=keyof typeof acceptanceCommitRequests;
export type AcceptanceCommitInput<M extends AcceptanceCommitMethod>=z.output<(typeof acceptanceCommitRequests)[M]>;
export interface AcceptedRelease {
  releaseId:string;projectId:string;runId:string;candidateId:string;candidateRevision:number;manifestHash:string;reviewHash:string;
  preparationOperationId:string;acceptanceOperationId:string;requestHash:string;proofHash:string;
  datasetId:string;previousReleaseId:string|null;acceptedBy:string;acceptedAt:string;
  acceptanceState:'ACCEPTED';publicationState:'PENDING';
}
export interface AcceptanceCommitResults {commitReleaseAcceptance:OperationResult;getAcceptedRelease:AcceptedRelease}
