import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import type {ReleaseDelivery,ReleaseDeliveryMaterial} from './release-delivery-protocol.js';
import type {WorkAssessment,WorkArtifactRef} from './work-verification-protocol.js';
import type {CandidateBasis} from './candidate-basis.js';
import type {QualityVerification,QualityMaterial} from './quality-protocol.js';
const read={principalId:opaqueKey,runId:ids.run};
const meta=z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()});
export const releaseFreezeRequests={
 prepareReleaseCandidateFreeze:z.strictObject({...read,integrationOperationId:ids.operation,deliveryOperationId:ids.operation}),
 freezeReleaseCandidate:z.strictObject({meta,runId:ids.run,ifMatch:z.string().optional(),integrationOperationId:ids.operation,deliveryOperationId:ids.operation,basisHash:sha256,contentHashes:z.array(sha256).min(1).max(2048)}),
 getReleaseCandidate:z.strictObject({...read,candidateId:ids.candidate}),
 getCurrentReleaseCandidate:z.strictObject(read),
 listReleaseCandidates:z.strictObject({...read,afterRevision:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type ReleaseFreezeMethod=keyof typeof releaseFreezeRequests;
export type ReleaseFreezeInput<M extends ReleaseFreezeMethod>=z.output<(typeof releaseFreezeRequests)[M]>;
export interface CandidateWorkProof {
 workId:string;workRevision:number;workEpoch:number;attemptId:string;role:string;relation:'CURRENT'|'CARRIED'|'MANUAL_PENDING';
 operationId:string;evidence:WorkArtifactRef;assessment:WorkAssessment;inputManifestHash:string;roleSnapshotHash:string;carryHash:string|null;
}
export interface ReleaseCandidateManifest {
 schemaVersion:'devmesh.release-candidate-manifest.v1';runId:string;projectId:string;runEpoch:number;planRevision:number;requirementRevision:number;
 checkConfigHash:string;templateVersion:string;codeCommit:string;automaticStatus:'PASS';reviewStatus:'PENDING'|'NOT_REQUIRED';
 source:{operationId:string;basis:CandidateBasis;manifestSha256:string};works:CandidateWorkProof[];
 quality:{verification:QualityVerification;materials:QualityMaterial[]}[];
 delivery:{record:ReleaseDelivery;materials:ReleaseDeliveryMaterial[]};
 issues:{issueId:string;revision:number;state:string;severity:string}[];
}
export interface ReleaseCandidateRevision {
 candidateId:string;operationId:string;runId:string;projectId:string;revision:number;manifestHash:string;createdAt:string;
 qualification:'CURRENT'|'STALE';manifest:ReleaseCandidateManifest;preflightHashes:string[];
}
export interface ReleaseCandidateSummary {
 candidateId:string;operationId:string;revision:number;manifestHash:string;codeCommit:string;createdAt:string;
 qualification:'CURRENT'|'STALE';automaticStatus:'PASS';reviewStatus:'PENDING'|'NOT_REQUIRED';
}
export interface ReleaseFreezeResults {
 prepareReleaseCandidateFreeze:{manifestHash:string;manifest:ReleaseCandidateManifest};
 freezeReleaseCandidate:ReleaseCandidateRevision;getReleaseCandidate:ReleaseCandidateRevision;
 getCurrentReleaseCandidate:ReleaseCandidateRevision|null;
 listReleaseCandidates:{items:ReleaseCandidateSummary[];nextRevision:number|null};
}
