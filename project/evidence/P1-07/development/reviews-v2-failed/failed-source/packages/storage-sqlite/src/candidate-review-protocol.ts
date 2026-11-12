import {z} from 'zod';
import {ids,opaqueKey,sha256,artifactRef} from '@devmesh/contracts';
const read={principalId:opaqueKey,runId:ids.run,candidateId:ids.candidate};
const text=z.string().trim().min(1).max(4096);
export const candidateReviewRequests={
 getCandidateReview:z.strictObject(read),
 recordCandidateReview:z.strictObject({meta:z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()}),runId:ids.run,candidateId:ids.candidate,ifMatch:z.string().optional(),manifestHash:sha256,itemId:opaqueKey,itemHash:sha256,previousResultId:opaqueKey.nullable(),verdict:z.enum(['PASS','FAIL']),procedure:text,expected:z.string().min(1).max(32768),observed:text,evidence:z.array(artifactRef).max(16)}),
 listCandidateReviewHistory:z.strictObject({...read,itemId:opaqueKey.optional(),afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
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
 canRecord:boolean;canPrepareAcceptance:boolean;
}
export interface CandidateReviewResults {
 getCandidateReview:CandidateReviewView;recordCandidateReview:CandidateHumanResult;
 listCandidateReviewHistory:{items:{sequence:number;result:CandidateHumanResult}[];nextSequence:number|null};
}
