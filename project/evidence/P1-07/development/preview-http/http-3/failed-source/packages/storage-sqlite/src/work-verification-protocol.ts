import {z} from 'zod';
import {ids,opaqueKey,roleOutput} from '@devmesh/contracts';
import type {WorkRevision} from '@devmesh/contracts';
const subject={principalId:opaqueKey,operationId:ids.operation};
export const workVerificationTarget={operationId:ids.operation};
export const workVerificationRequests={
 getWorkVerificationCandidate:z.strictObject({principalId:opaqueKey,runId:ids.run,attemptId:ids.attempt}),
 beginWorkVerification:z.strictObject({...subject,runId:ids.run,attemptId:ids.attempt,candidate:roleOutput,qualityOperationId:ids.operation.nullable().default(null)}),
 getWorkVerification:z.strictObject(subject),
 listWorkVerifications:z.strictObject({principalId:opaqueKey,runId:ids.run,afterOperationId:z.string().default(''),limit:z.number().int().min(1).max(100).default(50)}),
};
export type WorkVerificationMethod=keyof typeof workVerificationRequests;
export type WorkVerificationInput<M extends WorkVerificationMethod>=z.output<(typeof workVerificationRequests)[M]>;
export interface WorkArtifactRef {artifactId:string;sha256:string}
export interface WorkAssessment {
 schemaVersion:'devmesh.work-verification.v1';runId:string;attemptId:string;workId:string;workRevision:number;inputFingerprint:string;basisSha256:string;
 candidate:WorkArtifactRef;outputs:{slot:string;ref:WorkArtifactRef}[];codeCommit:string|null;qualityOperationId:string|null;
 checks:{kind:string;status:'PASS'|'FAIL'|'MISSING'|'PENDING';code:string}[];
 automaticStatus:'PASS'|'FAIL'|'MISSING'|'PENDING';outcome:'success'|'completed-with-findings'|null;
}
export interface WorkVerification {operationId:string;principalId:string;runId:string;attemptId:string;requestHash:string;state:'PREPARED'|'READY'|'APPLIED';qualification:'CURRENT'|'STALE';evaluation:WorkAssessment;expectedHash:string;byteSize:number;writeKey:string;completionKey:string;artifactId:string|null;contentHash:string|null;writeId:string|null}
export interface WorkVerificationResults {
 getWorkVerificationCandidate:{candidate:WorkArtifactRef;work:WorkRevision};beginWorkVerification:WorkVerification;getWorkVerification:WorkVerification;listWorkVerifications:WorkVerification[];
}
