import type {Router,Request,Response,RequestHandler} from 'express';
import {z} from 'zod';
import {readFile} from 'node:fs/promises';
import {previewManagementPage} from './preview-management-page.js';
import {getWorkbenchReturnContext} from './workbench-return.js';
import {ids,sha256,idempotencyKey,parseContract,candidatePreviewWorkspace,previewDatasetManagement,previewManagement,createPreviewDatasetInput,createPreviewIntentInput,stopPreviewIntentInput} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const empty=z.strictObject({}),cursor=z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().nonnegative().safe()),page=z.strictObject({afterDatasetSequence:cursor.optional(),afterPreviewSequence:cursor.optional(),limit:z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().min(1).max(20)).optional()});
const fail=(code:string,status:number):never=>{throw new StorageError(code,status,'Exact candidate preview management unavailable');};

export function mountPreviewManagementRoutes(router:Router,content:LocalContentStore,selected:Readonly<Record<string,string>>|undefined,route:Route){
 const policies=new Map<string,string>(Object.entries(selected??{}).map(([projectId,policyHash])=>[ids.project.parse(projectId),sha256.parse(policyHash)])),storage=content.storage,base='/runs/:runId/candidates/:candidateId/preview-management';
 const subject=(request:Request,identity:Identity)=>({principalId:identity.principalId,runId:parseContract(ids.run,request.params.runId),candidateId:parseContract(ids.candidate,request.params.candidateId)});
 const guarded:Route=handler=>route(async(request,response,identity)=>{try{await handler(request,response,identity);}catch(error){if(error instanceof StorageError){if(error.status===404)fail('RESOURCE_NOT_FOUND',404);if(error.code.startsWith('PREVIEW_')||error.code.startsWith('CANDIDATE_')||error.code.startsWith('RELEASE_CANDIDATE_'))fail('PREVIEW_UNAVAILABLE',error.status===503?503:error.status===422?422:409);}throw error;}});
 async function scoped(who:ReturnType<typeof subject>){const c=await storage.request('getReleaseCandidate',who),policyHash=policies.get(c.projectId);return {...who,...(policyHash?{policyHash}:{})};}
 async function recheck(who:ReturnType<typeof subject>){await storage.request('getReleaseCandidate',who);}
 function conditional(request:Request,who:ReturnType<typeof subject>,scopeId:string=who.runId){empty.parse(request.query);if(!request.is('application/json'))fail('CONTENT_TYPE_INVALID',415);const match=request.headers['if-match'];return {meta:{principalId:who.principalId,scopeId,idempotencyKey:parseContract(idempotencyKey,request.headers['idempotency-key'])},runId:who.runId,...(match===undefined?{}:{ifMatch:parseContract(z.string().max(128),match)})};}
 router.get(base+'/view',guarded(async(request,response,identity)=>{empty.parse(request.query);const who=subject(request,identity),value=parseContract(candidatePreviewWorkspace,await storage.request('getCandidatePreviewWorkspace',await scoped(who)));await recheck(who);const rendered=previewManagementPage(value,await getWorkbenchReturnContext(content,identity.principalId,value.runId));response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Content-Security-Policy',rendered.policy);response.type('text/html; charset=utf-8').send(rendered.html);}));
 router.get(base+'/client.js',guarded(async(request,response,identity)=>{empty.parse(request.query);const who=subject(request,identity);await storage.request('getCandidatePreviewWorkspace',await scoped(who));const bytes=await readFile(new URL('./web/preview-management/preview-management-client.js',import.meta.url));await recheck(who);response.type('application/javascript; charset=utf-8').send(bytes);}));
 router.get(base,guarded(async(request,response,identity)=>{const query=parseContract(page,request.query),who=subject(request,identity),value=parseContract(candidatePreviewWorkspace,await storage.request('getCandidatePreviewWorkspace',{...await scoped(who),...query}));await recheck(who);response.setHeader('ETag','"r'+value.resourceRevision+'"');response.json(value);}));
 router.get(base+'/datasets/:datasetId',guarded(async(request,response,identity)=>{empty.parse(request.query);const who=subject(request,identity),value=parseContract(previewDatasetManagement,await storage.request('getCandidatePreviewDataset',{...await scoped(who),datasetId:parseContract(ids.dataset,request.params.datasetId)}));await recheck(who);response.json(value);}));
 router.get(base+'/previews/:previewId',guarded(async(request,response,identity)=>{empty.parse(request.query);const who=subject(request,identity),value=parseContract(previewManagement,await storage.request('getCandidatePreview',{...who,previewId:parseContract(ids.preview,request.params.previewId)}));await recheck(who);response.json(value);}));
 router.post(base+'/datasets',guarded(async(request,response,identity)=>{
  const who=subject(request,identity),write=conditional(request,who),body=parseContract(createPreviewDatasetInput,request.body),scope=await scoped(who),view=await storage.request('getCandidatePreviewWorkspace',scope);
  if(!view.canManage)fail('FORBIDDEN',403);if(!await storage.request('lookupOperation',write.meta)&&(!view.configured||body.policyHash!==view.policyHash))fail('PREVIEW_UNAVAILABLE',503);
  const d=await storage.request('createPreviewDataset',{...write,candidateId:who.candidateId,...body}),value=parseContract(previewDatasetManagement,await storage.request('getCandidatePreviewDataset',{...scope,datasetId:d.datasetId}));await recheck(who);response.status(202).json(value);
 }));
 router.post(base+'/previews',guarded(async(request,response,identity)=>{
  const who=subject(request,identity),write=conditional(request,who),body=parseContract(createPreviewIntentInput,request.body),scope=await scoped(who),view=await storage.request('getCandidatePreviewWorkspace',scope);
  if(!view.canManage)fail('FORBIDDEN',403);const d=await storage.request('getPreviewDataset',{principalId:who.principalId,runId:who.runId,datasetId:body.datasetId});
  if(d.candidateId!==who.candidateId)fail('RESOURCE_NOT_FOUND',404);if(!await storage.request('lookupOperation',write.meta)&&(!view.configured||d.policyHash!==view.policyHash))fail('PREVIEW_UNAVAILABLE',503);
  const p=await storage.request('createPreviewIntent',{...write,candidateId:who.candidateId,...body}),value=parseContract(previewManagement,await storage.request('getCandidatePreview',{...who,previewId:p.previewId}));await recheck(who);response.status(202).json(value);
 }));
 router.post(base+'/previews/:previewId/stop',guarded(async(request,response,identity)=>{
  const who=subject(request,identity),previewId=parseContract(ids.preview,request.params.previewId),write=conditional(request,who,previewId),body=parseContract(stopPreviewIntentInput,request.body);await storage.request('getCandidatePreview',{...who,previewId});
  const p=await storage.request('stopPreviewIntent',{meta:write.meta,runId:who.runId,previewId,previewRevision:body.previewRevision,impactReviewHash:body.impactReviewHash,reason:'USER'}),value=parseContract(previewManagement,await storage.request('getCandidatePreview',{...who,previewId:p.previewId}));await recheck(who);response.status(202).json(value);
 }));
}
