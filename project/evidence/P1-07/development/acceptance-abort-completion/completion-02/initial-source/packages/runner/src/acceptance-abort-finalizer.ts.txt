import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {canonical,acceptanceAbortCompletionEvidence} from '@devmesh/storage-sqlite';
import type {SqliteStorage,AcceptanceAbortCompletion,AcceptancePreparationRequest,AcceptanceAbortRecoveryResults,acceptanceAbortSourceRecovery,acceptanceDatasetAbortProof} from '@devmesh/storage-sqlite';
import type {RunnerStore} from './store.js';
import type {RunnerAcceptanceDatasetAbortBackend} from './acceptance-dataset-abort-backend.js';
import {datasetHash} from './dataset-journal.js';
import {RunnerError} from './protocol.js';

export interface AcceptanceAbortSourceRecoveryAuthority {
 readonly configured:boolean;
 /** Query the exact restored original Release and its existing serving claim.
  * Never acquire, renew, start a service or open a write gate in this method. */
 inspect(input:{preparation:AcceptancePreparationRequest;decisionHash:string;sourceGate:NonNullable<AcceptanceAbortRecoveryResults['getAcceptanceAbortRecovery']['sourceGate']>;sourceImageDigest:string;dataProof:z.output<typeof acceptanceDatasetAbortProof>}):Promise<z.output<typeof acceptanceAbortSourceRecovery>|null>;
}
const options=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,principalId:opaqueKey,backendRef:opaqueKey});
const input=z.strictObject({operationId:ids.operation,requestHash:sha256});
export type AcceptanceAbortFinalization={state:'ABORTED';completion:AcceptanceAbortCompletion}|{state:'UNKNOWN';errorCode:string};
/** Trusted composition, deliberately opt-in. Caller supplies only original IDs;
 * cleanup comes from Runner SQLite and data proof from the durable file Worker. */
export class RunnerAcceptanceAbortFinalizer {
 readonly options:z.output<typeof options>;
 constructor(readonly store:Pick<RunnerStore,'request'|'options'>,readonly control:Pick<SqliteStorage,'request'>,readonly data:Pick<RunnerAcceptanceDatasetAbortBackend,'configured'|'advance'>,readonly source:AcceptanceAbortSourceRecoveryAuthority|undefined,raw:z.input<typeof options>){this.options=options.parse(raw);if(store.options.runnerId!==this.options.runnerId)throw new RunnerError('RUNNER_STORE_IDENTITY_MISMATCH',409);}
 get configured(){return this.options.enabled&&this.data.configured;}
 async advance(raw:z.input<typeof input>):Promise<AcceptanceAbortFinalization>{
  if(!this.configured)throw new RunnerError('ACCEPTANCE_ABORT_FINALIZER_NOT_CONFIGURED',503,'not-sent');const i=input.parse(raw),record=await this.control.request('getAcceptanceAbortDecision',{principalId:this.options.principalId,preparationOperationId:i.operationId,requestHash:i.requestHash});if(!record)throw new RunnerError('ACCEPTANCE_ABORT_NOT_REQUESTED',409);
  const q=record.decision.preparation;if(q.runnerId!==this.options.runnerId||q.backendRef!==this.options.backendRef||q.backendPrincipalId!==this.options.principalId||datasetHash(canonical(record.decision))!==record.decisionHash)throw new RunnerError('ACCEPTANCE_ABORT_IDENTITY_CHANGED',409);
  const bound={principalId:this.options.principalId,preparationOperationId:i.operationId,requestHash:i.requestHash,decisionHash:record.decisionHash},context=await this.control.request('getAcceptanceAbortRecovery',bound);
  if(context.completion)return {state:'ABORTED',completion:context.completion};
  if(q.source&&(!this.source?.configured||!context.sourceGate||!context.sourceImageDigest))return {state:'UNKNOWN',errorCode:'ACCEPTANCE_SOURCE_RECOVERY_NOT_CONFIGURED'};
  const cleanup=await this.store.request('acceptanceAbortGet',{controllerId:this.options.controllerId,operationId:i.operationId,decisionHash:record.decisionHash});
  if(canonical(cleanup.record)!==canonical(record)||!cleanup.serviceCleared||!cleanup.networkCleared)return {state:'UNKNOWN',errorCode:'ACCEPTANCE_ABORT_SERVICE_UNRESOLVED'};
  const observation=await this.data.advance(i);if(observation.state!=='RESTORED_CLOSED')return observation;
  const sourceRecovery=q.source?await this.source!.inspect({preparation:q,decisionHash:record.decisionHash,sourceGate:context.sourceGate!,sourceImageDigest:context.sourceImageDigest!,dataProof:observation.receipt.proof}):null;
  if(q.source&&!sourceRecovery)return {state:'UNKNOWN',errorCode:'ACCEPTANCE_SOURCE_RECOVERY_UNVERIFIED'};
  const r=cleanup.reservation,journal=r?await this.store.request('acceptanceServiceJournal',{controllerId:this.options.controllerId,reservationId:r.reservationId,requestHash:r.requestHash}):null;
  const evidence=acceptanceAbortCompletionEvidence.parse({schemaVersion:'devmesh.acceptance-abort-completion.v1',operationId:i.operationId,requestHash:i.requestHash,decisionHash:record.decisionHash,service:{controllerId:this.options.controllerId,cleanupHash:datasetHash(canonical(cleanup)),reservationId:r?.reservationId??null,profileHash:journal?.profileHash??null,instanceId:r?.instanceId??null,networkId:journal?.networkId??null,state:'CLEARED'},data:observation.receipt,sourceGate:context.sourceGate,sourceRecovery});
  return {state:'ABORTED',completion:await this.control.request('completeAcceptanceAbort',{...bound,evidence})};
 }
}
