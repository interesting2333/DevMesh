// Actual control Worker and decisions; physical cleanup/fence evidence below
// is explicit protocol data, not a physical adapter implementation.
import {acceptanceFixture} from './acceptance.mjs';
import {decideAbort,completionEvidence,recoveryBinding} from './acceptance-abort-completion.mjs';
export const abortScope=(f,backend)=>({projectId:f.p.projectId,policyHash:f.policyHash,principalId:f.policy.backendPrincipalId,backendRef:f.policy.backendRef,runnerId:f.policy.runnerId,backend});
export async function nextAbort(f){const p=(await f.call('markAcceptancePreparationSent',f.bound(await f.call('beginAcceptancePreparation',await f.request())))).preparation,record=await decideAbort(f,p);return {p,record};}
export async function abortConsumerFixture(t){const f=await acceptanceFixture(t),original=await nextAbort(f);return {...f,...original,storage:{request:(m,i)=>f.call(m,i)}};}
export function explicitAbortBackend(f,{complete=true}={}){return {configured:true,complete,calls:0,async advance(i,signal){this.calls++;signal?.throwIfAborted();const record=await f.call('getAcceptanceAbortDecision',{principalId:f.policy.backendPrincipalId,preparationOperationId:i.operationId,requestHash:i.requestHash}),p=await f.call('getAcceptancePreparation',{principalId:f.policy.backendPrincipalId,operationId:i.operationId}),bound=recoveryBinding(p,record),context=await f.call('getAcceptanceAbortRecovery',bound);if(context.completion)return {state:'ABORTED',completion:context.completion};if(!this.complete)return {state:'UNKNOWN',errorCode:'FIXTURE_ABORT_UNRESOLVED'};signal?.throwIfAborted();return {state:'ABORTED',completion:await f.call('completeAcceptanceAbort',{...bound,evidence:completionEvidence(p,record,context)})};}};}
export const barrier=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
export function cleanupDriver(f){return Object.assign(f.driver,{
 async stop(p,r,n,id,authorize){if(!await authorize())throw Error('Explicit cleanup denied');const x=await this.inspect(p,r,n,id);if(x?.state==='running'){this.calls.push('STOP');Object.assign(this.containers.get(p.containerName),{state:'exited',pid:0,exitCode:0,endpoint:null});}return this.inspect(p,r,n,id);},
 async containerAbsent(id){return ![...this.containers.values()].some(x=>x.containerId===id);},async networkAbsent(id){return ![...this.networks.values()].includes(id);},
 async removeContainer(p,r,n,id,authorize){if(!await authorize())throw Error('Explicit cleanup denied');this.calls.push('CONTAINER_REMOVE');this.containers.delete(p.containerName);},
 async removeNetwork(p,r,n,authorize){if(!await authorize())throw Error('Explicit cleanup denied');this.calls.push('NETWORK_REMOVE');this.networks.delete(p.networkName);},
});}
