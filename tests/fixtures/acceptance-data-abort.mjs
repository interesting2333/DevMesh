// Explicit in-memory physical authority facts. Actual files/Workers are tested;
// this fixture does not prove Linux exclusion, durable physical revocation or IO drain.
import assert from 'node:assert/strict';
import {acceptanceAbortDecision} from '../../packages/storage-sqlite/dist/index.mjs';
import {RunnerAcceptanceDatasetAbortBackend,RunnerError} from '../../packages/runner/dist/index.mjs';
import {acceptanceDatasetFixture,acceptanceDatasetPreparation} from './acceptance-datasets.mjs';
import {hash,canonical} from './storage-data.mjs';
export function abortRecord(p){const decision=acceptanceAbortDecision.parse({schemaVersion:'devmesh.acceptance-abort-decision.v1',operationId:'op_abort_'+hash(p.operationId).slice(0,24),preparation:p.request,preparationRequestHash:p.requestHash,preparationRevision:p.revision,preparedProofHash:null,requestedBy:'owner.explicit.data.abort.fixture',reason:'Explicit fixture decision; not product acceptance.',decidedAt:new Date().toISOString()});return {decision,decisionHash:hash(canonical(decision))};}
export function abortAuthority(data){
 const results=new Map(),revoked=new Set(),originalAcquire=data.authority.acquire.bind(data.authority),originalInspect=data.authority.inspect.bind(data.authority);
 data.authority.acquire=async(p,a)=>{if(revoked.has(p.operationId))throw new RunnerError('EXPLICIT_PREPARATION_REVOKED',409);return originalAcquire(p,a);};data.authority.inspect=async p=>{if(revoked.has(p.operationId))throw new RunnerError('EXPLICIT_PREPARATION_REVOKED',409);return originalInspect(p);};
 const successor=(old,key)=>({fenceId:old?.fenceId??'explicit.abort.'+key,generation:(old?.generation??0)+1,proofHash:hash('explicit successor '+key),previousHoldHash:old?.proofHash??null});
 return {configured:true,results,revoked,calls:0,queries:0,failAfter:false,queryFails:false,before:null,transform:null,
  async abort(j,authorize){await this.before?.(j,authorize);assert.equal(await authorize(),true);this.calls++;const q=j.request.decision.preparation;assert.equal(results.has(q.operationId),false,'duplicate physical abort');const f=data.authority.records.get(q.operationId)??null;revoked.add(q.operationId);let proof={schemaVersion:'devmesh.acceptance-dataset-aborted.v1',operationId:q.operationId,abortOperationId:j.request.decision.operationId,decisionHash:j.request.decisionHash,requestHash:j.requestHash,originalFences:f,revocation:{barrierId:'explicit.barrier.'+q.operationId,generation:1,proofHash:hash('explicit permanent revocation '+q.operationId),state:'PERMANENTLY_REVOKED'},target:{...successor(f?.targetFence.physical,q.operationId+'.target'),datasetId:q.target.datasetId,writeState:'CLOSED'},source:q.source?{...successor(f?.sourceFence?.physical,q.operationId+'.source'),releaseId:q.source.releaseId,datasetId:q.source.datasetId,datasetOperationId:q.source.datasetOperationId,owner:'ORIGINAL_RELEASE',writeState:'CONTROL_CLOSED'}:null,settledAt:new Date().toISOString()};proof=this.transform?.(proof,j)??proof;results.set(q.operationId,structuredClone(proof));if(this.failAfter){this.failAfter=false;throw Error('explicit physical abort ACK loss');}return structuredClone(proof);},
  async inspectAbort(j){this.queries++;await this.queryBefore?.(j);if(this.queryFails)throw Error('explicit physical abort query failed');return structuredClone(results.get(j.request.decision.preparation.operationId)??null);}
 };
}
export async function dataAbortFixture(t,{preparation=acceptanceDatasetPreparation({initialData:'DEMO'}),materialize=true}={}){
 const data=await acceptanceDatasetFixture(t),p=preparation;if(materialize)await data.prepareAcceptance(p);const record=abortRecord(p),store=data.layout.store,options={...data.backendOptions,backendRef:p.request.backendRef,enabled:true,controllerId:'controller.data.abort.fixture',principalId:p.request.backendPrincipalId},authority=abortAuthority(data);let currentRecord=record;
 const control={async request(m,i){assert.equal(m,'getAcceptanceAbortDecision');assert.equal(i.preparationOperationId,p.operationId);assert.equal(i.requestHash,p.requestHash);return currentRecord;}};
 await store.request('acceptanceAbortEnroll',{controllerId:options.controllerId,...record});
 const make=(changes={},storeOverride=store)=>new RunnerAcceptanceDatasetAbortBackend(storeOverride,control,authority,{...options,...changes});
 return {data,p,record,store,options,authority,control,make,backend:make(),input:{operationId:p.operationId,requestHash:p.requestHash},paths:()=>data.pathsFor(p),setRecord(value){currentRecord=value;}};
}
