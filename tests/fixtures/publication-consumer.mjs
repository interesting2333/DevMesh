// Explicit publication adapter statements. No real physical fence, route,
// container, data initialization or migration is exercised by this adapter.
import {publishedObservation} from './release-publication.mjs';
export const publicationScope=(f,backend)=>({projectId:f.p.projectId,policyHash:f.policyHash,principalId:f.policy.backendPrincipalId,backendRef:f.policy.backendRef,runnerId:f.policy.runnerId,backend});
export function explicitPublicationBackend({resume=false,complete=true}={}){
 let saved;const counts={preflight:0,publish:0,inspect:0,resume:0},unknown=()=>({state:'UNKNOWN',errorCode:'FIXTURE_ORIGINAL_ROUTE_UNAVAILABLE',checkedAt:new Date().toISOString()});
 const backend={configured:true,complete,counts,async preflight(){counts.preflight++;},async publish(p,authorize){counts.publish++;if(!await authorize())return unknown();if(!backend.complete)return unknown();saved=publishedObservation(p);return saved;},async inspect(){counts.inspect++;return saved?{...saved,checkedAt:new Date().toISOString()}:unknown();}};
 if(resume)backend.resume=async(p,authorize)=>{counts.resume++;if(!await authorize()||!backend.complete)return unknown();saved=publishedObservation(p);return saved;};
 return backend;
}
export const barrier=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
