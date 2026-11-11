import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import type {CandidateBasis} from './candidate-basis.js';

export const candidateSubjectFields={principalId:opaqueKey,runId:ids.run,purpose:z.enum(['run-candidate','work-input']),workId:ids.work.optional()};
export const validCandidateSubject=(value:{purpose:string;workId?:string|undefined})=>value.purpose==='work-input'?value.workId!==undefined:value.workId===undefined;
export const candidateRequests={
 getCandidateSourceBasis:z.strictObject(candidateSubjectFields).refine(validCandidateSubject,{message:'A work-input requires exactly one target Work'}),
 assertCandidateSourceBasis:z.strictObject({...candidateSubjectFields,basisSha256:sha256}).refine(validCandidateSubject,{message:'A work-input requires exactly one target Work'}),
};
export type CandidateMethod=keyof typeof candidateRequests;
export interface CandidateResults {getCandidateSourceBasis:CandidateBasis;assertCandidateSourceBasis:CandidateBasis}
