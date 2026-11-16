import {z} from 'zod';
import {ids,revision,epoch,sha256,gitCommit,timestamp} from './primitives.js';

export const workbenchCandidateSummary=z.strictObject({candidateId:ids.candidate,revision,manifestHash:sha256,codeCommit:gitCommit,createdAt:timestamp,qualification:z.enum(['CURRENT','STALE']),automaticStatus:z.literal('PASS'),reviewStatus:z.enum(['PENDING','NOT_REQUIRED'])});
export const workbenchDeliveryView=z.strictObject({
 projectId:ids.project,runId:ids.run,resourceRevision:revision,projectRevision:revision,eventCursor:epoch,
 mode:z.enum(['current','history']),membership:z.enum(['owner','operator','viewer']),
 candidates:z.array(workbenchCandidateSummary).max(20),nextRevision:revision.nullable(),selectedCandidate:workbenchCandidateSummary.nullable(),
 acceptedRelease:z.strictObject({releaseId:ids.release,runId:ids.run,candidateId:ids.candidate,codeCommit:gitCommit,acceptedAt:timestamp,isCurrentAccepted:z.literal(true)}).nullable(),
}).superRefine((value,ctx)=>{
 if(new Set(value.candidates.map(item=>item.candidateId)).size!==value.candidates.length||value.candidates.some((item,index)=>index>0&&item.revision<=value.candidates[index-1]!.revision))ctx.addIssue({code:'custom',message:'Candidate page must be unique and ordered by its exact revision'});
 if(value.nextRevision!==null&&value.nextRevision!==value.candidates.at(-1)?.revision)ctx.addIssue({code:'custom',message:'Candidate cursor must refer to the end of this page'});
});
