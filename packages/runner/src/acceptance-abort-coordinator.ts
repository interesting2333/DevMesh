import {z} from 'zod';
import {opaqueKey} from '@devmesh/contracts';
import type {AcceptanceAbortRecoveryBackend,AcceptanceAbortFinalization} from '@devmesh/storage-sqlite';
import type {RunnerAcceptanceAbortBackend} from './acceptance-abort-backend.js';
import type {RunnerAcceptanceAbortFinalizer} from './acceptance-abort-finalizer.js';
import {RunnerError} from './protocol.js';

const options=z.strictObject({enabled:z.boolean().default(false),runnerId:opaqueKey,controllerId:opaqueKey,principalId:opaqueKey,backendRef:opaqueKey});
/** Compose original cleanup and completion only, never a new abort decision. */
export class RunnerAcceptanceAbortCoordinator implements AcceptanceAbortRecoveryBackend {
 readonly options:z.output<typeof options>;
 readonly #cleanup:RunnerAcceptanceAbortBackend['advance'];
 readonly #finalize:RunnerAcceptanceAbortFinalizer['advance'];
 constructor(readonly cleanup:Pick<RunnerAcceptanceAbortBackend,'configured'|'advance'|'options'>,readonly finalizer:Pick<RunnerAcceptanceAbortFinalizer,'configured'|'advance'|'options'>,raw:z.input<typeof options>){
  this.options=Object.freeze(options.parse(raw));
  for(const part of [cleanup,finalizer])for(const key of ['runnerId','controllerId','principalId','backendRef'] as const)if(part.options[key]!==this.options[key])throw new RunnerError('ACCEPTANCE_ABORT_COORDINATOR_IDENTITY_CHANGED',409);
  this.#cleanup=cleanup.advance.bind(cleanup);this.#finalize=finalizer.advance.bind(finalizer);
 }
 get configured(){return this.options.enabled&&this.cleanup.configured&&this.finalizer.configured;}
 async advance(input:{operationId:string;requestHash:string},signal?:AbortSignal):Promise<AcceptanceAbortFinalization>{
  signal?.throwIfAborted();
  if(!this.configured)throw new RunnerError('ACCEPTANCE_ABORT_COORDINATOR_NOT_CONFIGURED',503,'not-sent');
  const result=await this.#cleanup(input,signal);
  signal?.throwIfAborted();
  if(!result.serviceCleared||!result.networkCleared)return {state:'UNKNOWN',errorCode:'ACCEPTANCE_ABORT_SERVICE_UNRESOLVED'};
  return this.#finalize(input,signal);
 }
}
