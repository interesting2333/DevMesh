import type {Router,Request,Response,RequestHandler} from 'express';
import {z} from 'zod';
import {ids,parseContract,workbenchDeliveryView,workbenchCandidateSummary,releaseExportEntryView} from '@devmesh/contracts';
import {canonical,StorageError} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const cursor=z.string().regex(/^(0|[1-9][0-9]{0,15})$/).transform(Number).pipe(z.number().int().safe().nonnegative()),query=z.strictObject({afterRevision:cursor.optional(),selectedCandidateId:ids.candidate.optional(),limit:z.string().regex(/^[1-9][0-9]?$/).transform(Number).pipe(z.number().int().min(1).max(20)).optional()});
const missing=():never=>{throw new StorageError('RESOURCE_NOT_FOUND',404,'Exact Run delivery is not visible');};
function summary(value:z.input<typeof workbenchCandidateSummary>){return parseContract(workbenchCandidateSummary,{candidateId:value.candidateId,revision:value.revision,manifestHash:value.manifestHash,codeCommit:value.codeCommit,createdAt:value.createdAt,qualification:value.qualification,automaticStatus:value.automaticStatus,reviewStatus:value.reviewStatus});}

export function mountWorkbenchDeliveryRoutes(router:Router,content:LocalContentStore,route:Route):void{
 const guarded:Route=handler=>route(async(request,response,identity)=>{try{await handler(request,response,identity);}catch(error){if(error instanceof StorageError&&error.status===404)missing();throw error;}});
 router.get('/projects/:projectId/runs/:runId/delivery',guarded(async(request,response,identity)=>{
  const projectId=parseContract(ids.project,request.params.projectId),runId=parseContract(ids.run,request.params.runId),q=parseContract(query,request.query),principalId=identity.principalId,storage=content.storage;
  const read=()=>storage.request('getInputWorkspace',{principalId,projectId,runId,limit:1}),before=await read();
  if(before.project.projectId!==projectId||before.run.runId!==runId||before.run.projectId!==projectId)missing();
  const page=await storage.request('listReleaseCandidates',{principalId,runId,afterRevision:q.afterRevision??0,limit:q.limit??20});
  let selectedCandidate=null;
  if(q.selectedCandidateId){
   const exact=await storage.request('getReleaseCandidate',{principalId,runId,candidateId:q.selectedCandidateId});
   if(exact.projectId!==projectId||exact.runId!==runId||exact.candidateId!==q.selectedCandidateId)missing();
   selectedCandidate=summary({candidateId:exact.candidateId,revision:exact.revision,manifestHash:exact.manifestHash,codeCommit:exact.manifest.codeCommit,createdAt:exact.createdAt,qualification:exact.qualification,automaticStatus:exact.manifest.automaticStatus,reviewStatus:exact.manifest.reviewStatus});
  }
  let acceptedRelease=null;
  if(before.project.acceptedReleaseId!==null){
   const release=parseContract(releaseExportEntryView,await storage.request('getReleaseExportEntry',{principalId,releaseId:before.project.acceptedReleaseId})),owner=await storage.request('checkInputAccess',{principalId,runId:release.runId});
   if(owner.projectId!==projectId||release.releaseId!==before.project.acceptedReleaseId||!release.isCurrentAccepted)throw new StorageError('BASIS_SUPERSEDED',409,'Accepted release changed during this read');
   acceptedRelease={...release,isCurrentAccepted:true as const};
  }
  const after=await read(),basis=(s:typeof before)=>canonical({project:s.project,run:s.run,mode:s.mode,membership:s.membership,eventCursor:s.eventCursor});
  if(basis(before)!==basis(after))throw new StorageError('BASIS_SUPERSEDED',409,'Workbench delivery changed during this read');
  response.json(parseContract(workbenchDeliveryView,{projectId,runId,resourceRevision:before.run.resourceRevision,projectRevision:before.project.revision,eventCursor:before.eventCursor,mode:before.mode,membership:before.membership,candidates:page.items.map(summary),nextRevision:page.nextRevision,selectedCandidate,acceptedRelease}));
 }));
}
