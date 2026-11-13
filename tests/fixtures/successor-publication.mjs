// Real two-round control/Runner Workers, datasets, template HTTP and T5. Source,
// model/OCI, physical custody/guard/container/network/route are explicit fixtures.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {RunnerReleaseRetirementBackend,RunnerReleaseServiceBackend} from '../../packages/runner/dist/index.mjs';
import {ReleasePublisher} from '../../packages/platform-core/dist/index.mjs';
import {acceptanceSuccessorFixture} from './acceptance-successor.mjs';
import {canonical,hash} from './storage-data.mjs';

export async function successorPublicationFixture(t,{strategy='PRESERVE_MIGRATE'}={}){
 const f=await acceptanceSuccessorFixture(t,{strategy}),first=f.first,client={request:(m,i)=>f.control.call(m,i)},principalId=first.options.principalId;
 const firstPublication=await client.request('getReleasePublication',{principalId,releaseId:f.sourceReleaseId}),firstJournal=await first.current(),firstProof=canonical(firstPublication.proof),originalAcquire=first.data.authority.acquire;
 // Advance the synthetic source generation from its actual original publication.
 first.data.authority.acquire=async(p,authorize)=>{const g=await originalAcquire(p,authorize),old=firstPublication.proof.target;if(g.sourceFence){Object.assign(g.sourceFence.physical,{fenceId:old.fenceId,generation:old.generation+1,proofHash:hash('explicit successor custody '+old.proofHash+' '+p.operationId),heldAt:new Date().toISOString()});first.data.authority.records.set(p.operationId,structuredClone(g));}return g;};
 if(strategy==='REPLACE')await f.confirm();const pending=await f.begin(await f.request()),accepted=await f.commit(pending),p=accepted.preparation;
 assert.equal(accepted.ready.proof.sourceFence.physical.fenceId,firstPublication.proof.target.fenceId);assert(accepted.ready.proof.sourceFence.physical.generation>firstPublication.proof.target.generation);
 const records=new Map(),retirementCalls=[],authority={configured:true,async preflight(){},async revoke(r,controllerId,authorize){assert.equal(await authorize(),true);const q=r.promotion.preparation;retirementCalls.push('REVOKE_PREPARATION');const v={schemaVersion:'devmesh.release-preparation-revoked.v1',promotionRequestHash:r.promotionRequestHash,preparationOperationId:q.operationId,releaseId:q.releaseId,runnerId:q.runnerId,controllerId,barrierId:'fixture.successor.barrier.'+q.operationId,generation:1,proofHash:hash('explicit successor permanent revocation '+r.promotionRequestHash),state:'PERMANENTLY_REVOKED'};records.set(q.releaseId,v);return structuredClone(v);},async inspect(r){retirementCalls.push('query-revocation');return structuredClone(records.get(r.promotion.preparation.releaseId)??null);}};
 const baseline=first.calls.length,retirementBaseline=first.retirementBackend.driver.calls.length,acquisitions=first.data.authority.acquisitions;
 const makeBackend=()=>{const retirement=new RunnerReleaseRetirementBackend(first.store,client,first.retirementBackend.driver,authority,first.retirementBackend.options);return new RunnerReleaseServiceBackend(first.store,client,retirement,first.authority,first.driver,first.routes,first.options);};
 const publication=()=>client.request('getReleasePublication',{principalId,releaseId:p.releaseId}),advance=()=>new ReleasePublisher(client,principalId,makeBackend()).advance(p.releaseId);
 async function journal(){const v=await publication();if(!v.basis)return null;const r={schemaVersion:'devmesh.release-retirement.v1',promotion:v.request,promotionRequestHash:v.requestHash,gates:v.basis},s={...r,schemaVersion:'devmesh.release-service-start.v1',purpose:'RELEASE',retirementRequestHash:hash(canonical(r))};return first.store.request('releaseServiceGet',{controllerId:first.options.controllerId,releaseId:p.releaseId,requestHash:hash(canonical(s))});}
 const mutations=()=>({service:first.calls.slice(baseline).filter(c=>!c.startsWith('query-')),readonly:first.retirementBackend.driver.calls.slice(retirementBaseline).filter(c=>!c.startsWith('query-')),revocation:retirementCalls.filter(c=>!c.startsWith('query-'))});
 const receiptBytes=()=>readFile(join(first.data.pathsFor(p).directory,'receipt.json'));
 return {...f,client,principalId,preparation:p,accepted,firstPublication,firstJournal,firstProof,acquisitions,makeBackend,publication,advance,journal,mutations,receiptBytes,async reopen(){await first.reopen(true);await f.control.reopen();}};
}
