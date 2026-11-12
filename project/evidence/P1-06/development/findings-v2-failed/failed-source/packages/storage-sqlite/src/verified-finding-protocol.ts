import {z} from 'zod';
import {ids,opaqueKey,revision} from '@devmesh/contracts';
import type {QualityPolicy,QualityEvaluation} from '@devmesh/contracts';
import type {QualityOrigin} from './quality-protocol.js';
import type {IssueView,IssueOperation} from './tool-protocol.js';
const subject={principalId:opaqueKey,runId:ids.run};
const command={...subject,operationId:ids.operation,issueId:opaqueKey,issueRevision:revision};
export const verifiedFindingRequests={
 getVerifiedFinding:z.strictObject({...subject,issueId:opaqueKey,afterRevision:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(20).default(20)}),
 listVerifiedFindings:z.strictObject({...subject,afterIssueId:z.string().default(''),limit:z.number().int().min(1).max(100).default(50)}),
 linkVerifiedFindingFix:z.strictObject({...command,fixWorkId:ids.work}),
 recordVerifiedFindingResult:z.strictObject({...command,fixAttemptId:ids.attempt,verificationAttemptId:ids.attempt}),
};
export type VerifiedFindingMethod=keyof typeof verifiedFindingRequests;
export type VerifiedFindingInput<M extends VerifiedFindingMethod>=z.output<(typeof verifiedFindingRequests)[M]>;
export interface OriginalFailure {
 schemaVersion:'devmesh.original-failure.v1';workVerificationId:string;qualityOperationId:string;attemptId:string;workId:string;
 targetCommit:string;checkConfigHash:string;sourceManifestSha256:string;topologySha256:string;
 check:QualityPolicy['checks'][number];result:QualityEvaluation['checks'][number];
 reproduction:{producer:QualityPolicy['producers'][number];origin:QualityOrigin}[];
 expectedRequirements:{requirementId:string;sha256:string}[];
 expectedAcceptance:{requirementId:string;statement:string;acceptance:string[]}[];
 materials:{key:string;sha256:string;byteSize:number}[];
 evidence:{artifactId:string;sha256:string};
}
export interface VerifiedFindingView extends IssueView {failure:OriginalFailure;failureSha256:string}
export interface VerifiedFindingResults {
 getVerifiedFinding:VerifiedFindingView;listVerifiedFindings:VerifiedFindingView[];
 linkVerifiedFindingFix:IssueOperation;recordVerifiedFindingResult:IssueOperation;
}
