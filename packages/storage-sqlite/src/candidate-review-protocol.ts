import {z} from 'zod';
import {ids,opaqueKey,sha256,artifactRef} from '@devmesh/contracts';
const read={principalId:opaqueKey,runId:ids.run,candidateId:ids.candidate};
const text=z.string().trim().min(1).max(4096);
const meta=z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()});
export const candidateReviewRequests={
 getCandidateReview:z.strictObject(read),
 recordCandidateReview:z.strictObject({meta,runId:ids.run,candidateId:ids.candidate,ifMatch:z.string().optional(),manifestHash:sha256,itemId:opaqueKey,itemHash:sha256,previousResultId:opaqueKey.nullable(),verdict:z.enum(['PASS','FAIL']),procedure:text,expected:z.string().min(1).max(32768),observed:text,evidence:z.array(artifactRef).max(16)}),
 recordCandidateRejection:z.strictObject({meta,runId:ids.run,candidateId:ids.candidate,ifMatch:z.string().optional(),manifestHash:sha256,rejectionId:opaqueKey,previousResultId:opaqueKey.nullable(),classification:z.enum(['IN_SCOPE_DEFECT','SCOPE_CHANGE']),state:z.enum(['OPEN','WITHDRAWN']),itemId:opaqueKey.nullable(),itemHash:sha256.nullable(),description:text,reason:text,evidence:z.array(artifactRef).max(16)}),
 listCandidateReviewHistory:z.strictObject({...read,itemId:opaqueKey.optional(),afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
 listCandidateRejectionHistory:z.strictObject({...read,rejectionId:opaqueKey.optional(),afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type CandidateReviewMethod=keyof typeof candidateReviewRequests;
export type CandidateReviewInput<M extends CandidateReviewMethod>=z.output<(typeof candidateReviewRequests)[M]>;
export interface CandidateReviewItem {
 itemId:string;itemHash:string;kind:'requirement'|'work-human'|'quality-human';requirementIds:string[];
 subjectId:string;checkId:string;expected:string;
}
export interface CandidateHumanResult {
 resultId:string;operationId:string;candidateId:string;candidateRevision:number;manifestHash:string;item:CandidateReviewItem;
 previousResultId:string|null;principalId:string;verdict:'PASS'|'FAIL';procedure:string;expected:string;observed:string;
 evidence:{artifactId:string;sha256:string}[];createdAt:string;
}
export interface CandidateReviewView {
 candidateId:string;candidateRevision:number;manifestHash:string;qualification:'CURRENT'|'STALE';resourceRevision:number;
 automaticStatus:'PASS';humanStatus:'PASS'|'FAIL'|'MISSING'|'STALE';reviewHash:string;
 items:(CandidateReviewItem&{status:'PASS'|'FAIL'|'MISSING'|'STALE';result:CandidateHumanResult|null})[];
 automaticChecks:{operationId:string;checkId:string;status:string;codes:string[]}[];
 rejections:CandidateRejectionResult[];rejectionStatus:'OPEN'|'NONE';
 canRecord:boolean;canPrepareAcceptance:boolean;canWithdrawRejections:boolean;
}
export interface CandidateRejectionResult {
 resultId:string;operationId:string;candidateId:string;candidateRevision:number;manifestHash:string;rejectionId:string;previousResultId:string|null;
 classification:'IN_SCOPE_DEFECT'|'SCOPE_CHANGE';state:'OPEN'|'WITHDRAWN';item:CandidateReviewItem|null;
 description:string;reason:string;evidence:{artifactId:string;sha256:string}[];principalId:string;createdAt:string;
 nextAction:'REPAIR_REVIEW_REQUIRED'|'CHANGE_REVIEW_REQUIRED'|'NONE';applicationState:'NOT_APPLIED';
}
export interface CandidateReviewResults {
 getCandidateReview:CandidateReviewView;recordCandidateReview:CandidateHumanResult;
 listCandidateReviewHistory:{items:{sequence:number;result:CandidateHumanResult}[];nextSequence:number|null};
 recordCandidateRejection:CandidateRejectionResult;
 listCandidateRejectionHistory:{items:{sequence:number;result:CandidateRejectionResult}[];nextSequence:number|null};
}
