import {z} from 'zod';
import {sha256,timestamp} from '@devmesh/contracts';
import {canonical,acceptanceDatasetAbortRequest,acceptanceDatasetAbortProof,acceptanceDatasetAbortReceipt,acceptanceAbortFenceSuccessor as successor} from '@devmesh/storage-sqlite';
import {acceptanceDatasetFences,datasetHash} from './dataset-journal.js';
import {RunnerError} from './protocol.js';

export {acceptanceDatasetAbortRequest,acceptanceDatasetAbortProof,acceptanceDatasetAbortReceipt};
export const acceptanceDatasetAbortJournal=z.strictObject({schemaVersion:z.literal('devmesh.local-dataset-abort-operation.v1'),request:acceptanceDatasetAbortRequest,requestHash:sha256,originalJournalHash:sha256.nullable(),originalFences:acceptanceDatasetFences.nullable(),createdAt:timestamp});
export type AcceptanceDatasetAbortJournal=z.output<typeof acceptanceDatasetAbortJournal>;
export type AcceptanceDatasetAbortProof=z.output<typeof acceptanceDatasetAbortProof>;
export type AcceptanceDatasetAbortObservation={state:'RESTORED_CLOSED';receipt:z.output<typeof acceptanceDatasetAbortReceipt>}|{state:'UNKNOWN';errorCode:string};
/** Trusted physical adapter. A file/process lock or control CLOSED flag cannot
 * satisfy this contract. It must atomically tombstone the original acquisition,
 * settle in-flight work, fence late work and retain a stable queryable result.
 * Even when originalFences is null, query the authority's own original custody;
 * absence of a local file is never proof that acquisition did not occur. */
export interface AcceptanceDatasetAbortAuthority {
 readonly configured:boolean;
 abort(journal:AcceptanceDatasetAbortJournal,authorize:()=>Promise<boolean>):Promise<AcceptanceDatasetAbortProof>;
 /** Read the original result only; never acquire, renew, release or replace. */
 inspectAbort(journal:AcceptanceDatasetAbortJournal):Promise<AcceptanceDatasetAbortProof|null>;
}
export function validateDatasetAbortJournal(raw:unknown){
 const j=acceptanceDatasetAbortJournal.parse(raw),r=j.request;
 if(datasetHash(canonical(r))!==j.requestHash||datasetHash(canonical(r.decision))!==r.decisionHash)throw new RunnerError('ACCEPTANCE_DATA_ABORT_IDENTITY_CHANGED',409);
 validateOriginalAbortFences(j.originalFences,j);return j;
}
export function validateOriginalAbortFences(f:z.output<typeof acceptanceDatasetFences>|null,j:AcceptanceDatasetAbortJournal){
 const d=j.request.decision,q=d.preparation,s=q.source;
 if(f&&(f.operationId!==q.operationId||f.requestHash!==d.preparationRequestHash||f.targetFence.datasetId!==q.target.datasetId||(s?f.sourceFence?.datasetId!==s.datasetId||f.sourceFence.datasetOperationId!==s.datasetOperationId:f.sourceFence!==null)))throw new RunnerError('ACCEPTANCE_DATA_ABORT_CUSTODY_CHANGED',409);
 return f;
}
export function validateDatasetAbortProof(raw:unknown,j:AcceptanceDatasetAbortJournal){
 const p=acceptanceDatasetAbortProof.parse(raw),d=j.request.decision,q=d.preparation,s=q.source,f=validateOriginalAbortFences(p.originalFences,j);
 const follows=(next:z.output<typeof successor>,old:NonNullable<typeof f>['targetFence']['physical']|null)=>old?next.fenceId===old.fenceId&&next.generation>old.generation&&next.previousHoldHash===old.proofHash:next.previousHoldHash===null;
 if(p.operationId!==q.operationId||p.abortOperationId!==d.operationId||p.decisionHash!==j.request.decisionHash||p.requestHash!==j.requestHash||j.originalFences&&canonical(j.originalFences)!==canonical(f)||p.target.datasetId!==q.target.datasetId||!follows(p.target,f?.targetFence.physical??null)||(s?!p.source||p.source.datasetId!==s.datasetId||p.source.datasetOperationId!==s.datasetOperationId||p.source.releaseId!==s.releaseId||!follows(p.source,f?.sourceFence?.physical??null):p.source!==null)||Date.parse(p.settledAt)<Math.max(Date.parse(j.createdAt),Date.parse(d.decidedAt))||Date.parse(p.settledAt)>Date.now())throw new RunnerError('ACCEPTANCE_DATA_ABORT_PROOF_CHANGED',409);
 return p;
}
