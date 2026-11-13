// Actual file-backed Worker, immutable content bytes and HTTP. Source/admission,
// Runner/OCI/fences and manual observations remain explicit protocol fixtures.
import {once} from 'node:events';import {createRequire} from 'node:module';
import {mountInputApi} from '../../packages/input-api/dist/index.mjs';
import {LocalContentStore} from '../../packages/blob-store/dist/index.mjs';
import {ReleaseAcceptor} from '../../packages/platform-core/dist/index.mjs';
import {StorageError} from '../../packages/storage-sqlite/dist/index.mjs';
import {acceptanceFixture} from './acceptance.mjs';
import {preparedObservation,binding} from './acceptance-readiness.mjs';
import {hash,canonical} from './storage-data.mjs';
const express=createRequire(new URL('../../packages/input-api/package.json',import.meta.url))('express');
export async function acceptanceEntryFixture(t,{configured=true,browser=false,...options}={}){
  const f=await acceptanceFixture(t,options),storage={request:(...args)=>f.storage.request(...args)},content=new LocalContentStore(storage,f.content.dataRoot,0,f.provider),fault={corrupt:false,denyReads:false,dropCommitAck:false,reads:0},reader={async readBytes(...args){fault.reads++;if(fault.denyReads)throw Error('Fixture forbids a second preflight after committed ACK loss');const bytes=await content.readBytes(...args);return fault.corrupt?Buffer.from('Explicit corrupted material fixture'):bytes;}},acceptor=new ReleaseAcceptor(storage,reader),policies={[f.p.projectId]:f.policyHash};
  const access={policies,async commit(input){const result=await acceptor.accept(input);if(fault.dropCommitAck){fault.dropCommitAck=false;throw new StorageError('SERVICE_UNAVAILABLE',503,'Explicit injected committed ACK loss');}return result;}};
  async function mount(enabled=configured){const app=express(),api=mountInputApi(app,content,{enabled:true,baseline:{version:'acceptance.entry.fixture',baseCommit:'b'.repeat(40)},identityResolver:req=>browser||req.headers.authorization==='Bearer fixture_acceptance_owner'?{principalId:'user_1'}:req.headers.authorization==='Bearer fixture_acceptance_viewer'?{principalId:'acceptance.viewer'}:null,...(enabled?{acceptance:access}:{})}),server=app.listen(0,'127.0.0.1');await once(server,'listening');t.after(async()=>{await api.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});return {origin:'http://127.0.0.1:'+server.address().port,server,api};}
  const endpoint=await mount(),base='/api/v1/runs/'+f.p.runId+'/candidates/'+f.candidate.candidateId+'/acceptance',headers={authorization:'Bearer fixture_acceptance_owner'};
  const get=async(path=base,{origin=endpoint.origin,headers:extra={}}={})=>fetch(origin+path,{headers:{...headers,...extra}});
  const post=(path,body,{key=crypto.randomUUID(),match,origin=endpoint.origin,headers:extra={}}={})=>fetch(origin+path,{method:'POST',headers:{...headers,'content-type':'application/json','idempotency-key':key,...(match===undefined?{}:{'if-match':match}),...extra},body:JSON.stringify(body)});
  const read=async()=>{const response=await get();if(response.status!==200)throw Error('Acceptance entry '+response.status+' '+await response.text());return {response,basis:await response.json()};};
  const ready=async(operationId)=>{let p=await storage.request('getAcceptancePreparation',{principalId:'user_1',operationId});p=(await storage.request('markAcceptancePreparationSent',f.bound(p))).preparation;
    const o=preparedObservation(p),r=p.request,s=o.proof.service;s.claim={schemaVersion:'devmesh.acceptance-service-claim.v1',purpose:'ACCEPTANCE',operationId:p.operationId,acceptanceRequestHash:p.requestHash,releaseId:r.releaseId,projectId:r.projectId,runId:r.runId,candidateId:r.candidateId,manifestHash:r.manifestHash,reviewHash:r.reviewHash,dataPlanHash:r.dataPlanHash,datasetId:r.target.datasetId,imageDigest:r.image.imageDigest,reservationId:s.reservationId,profileHash:s.profileHash,serviceRequestHash:hash('Explicit entry fixture service'),instanceId:s.claim.instanceId};s.claimHash=hash(canonical(s.claim));o.health.claimHash=s.claimHash;
    const prior=await storage.request('getAcceptanceReadiness',binding(f,p));await storage.request('recordAcceptancePreparationObservation',{...binding(f,p),expectedPreparationRevision:p.revision,expectedSequence:prior.sequence,observation:o});return p;
  };
  const result={...f,...endpoint,content,base,headers,policies,access,fault,mount,httpGet:get,httpPost:post,read,ready};Object.defineProperty(result,'storage',{get:()=>f.storage});return result;
}
export function beginBody(b){return Object.fromEntries(['candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash','policyHash'].map(k=>[k,b[k]]));}
export function commitBody(p){return {...p.basis,runId:p.runId,preparationOperationId:p.operationId,requestHash:p.requestHash,expectedPreparationRevision:p.revision,expectedObservationSequence:p.readiness.sequence,proofHash:p.readiness.proofHash,confirmation:'ACCEPT_RELEASE'};}
