import type {Router,Request,Response,RequestHandler} from 'express';
import {z} from 'zod';
import {ids,sha256,parseContract,idempotencyKey,acceptanceBasisView,acceptancePreparationView,acceptancePreparationList,beginAcceptanceInput,confirmAcceptanceReplacementInput,closeUnsentAcceptanceInput,abortAcceptanceInput,acceptCandidateInput,acceptanceReplacementReceipt,acceptanceAbortReceipt,acceptanceCommitReceipt} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {Request as StorageRequest,OperationResult,AcceptancePreparation} from '@devmesh/storage-sqlite';
import type {LocalContentStore} from '@devmesh/blob-store';
import type {Identity} from './index.js';
import {readFile} from 'node:fs/promises';
import {acceptancePage} from './acceptance-page.js';

/** Only trusted composition may install this. Policies must already be registered;
 * commit must perform the ReleaseAcceptor's actual frozen-content preflight. */
export interface AcceptanceAccess {
  readonly policies:Readonly<Record<string,string>>;
  commit(input:StorageRequest<'commitReleaseAcceptance'>):Promise<OperationResult>;
}
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
const empty=z.strictObject({}),page=z.strictObject({afterSequence:z.string().regex(/^(0|[1-9][0-9]*)$/).transform(Number).pipe(z.number().int().nonnegative().safe()).optional(),limit:z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional()});
function fail(code:string,status:number):never{throw new StorageError(code,status,'Exact acceptance entry unavailable');}

export function mountAcceptanceRoutes(router:Router,content:LocalContentStore,access:AcceptanceAccess|undefined,route:Route):void{
  const policies=new Map<string,string>(Object.entries(access?.policies??{}).map(([projectId,policyHash])=>[ids.project.parse(projectId),sha256.parse(policyHash)]));
  if(access&&typeof access.commit!=='function')throw new Error('Trusted acceptance committer is required');
  const commit=access?.commit.bind(access),storage=content.storage,base='/runs/:runId/candidates/:candidateId/acceptance';
  const guarded:Route=handler=>route(async(request,response,identity)=>{try{await handler(request,response,identity);}catch(error){if(error instanceof StorageError){if(error.status===404)fail('RESOURCE_NOT_FOUND',404);if(error.code.startsWith('ACCEPTANCE_')||error.code.startsWith('ACCEPTED_RELEASE_')||error.code.startsWith('CANDIDATE_')||error.code.startsWith('RELEASE_CANDIDATE_'))fail('ACCEPTANCE_UNAVAILABLE',error.status===503?503:error.status===422?422:409);}throw error;}});
  const subject=(request:Request,identity:Identity)=>({principalId:identity.principalId,runId:parseContract(ids.run,request.params.runId),candidateId:parseContract(ids.candidate,request.params.candidateId)});
  async function basis(who:{principalId:string;runId:string;candidateId:string}){
    const candidate=await storage.request('getReleaseCandidate',who),policyHash=policies.get(candidate.projectId);
    return parseContract(acceptanceBasisView,await storage.request('getCandidateAcceptanceBasis',{...who,...(policyHash?{policyHash}:{})}));
  }
  async function original(who:{principalId:string;runId:string;candidateId:string},operationId:string){
    // Authorize the URL candidate before looking up an unrelated operation.
    await storage.request('getReleaseCandidate',who);const p=await storage.request('getAcceptancePreparation',{principalId:who.principalId,operationId});
    if(p.runId!==who.runId||p.candidateId!==who.candidateId)fail('RESOURCE_NOT_FOUND',404);return p;
  }
  async function project(who:{principalId:string;runId:string;candidateId:string},p:AcceptancePreparation){
    const ready=await storage.request('getAcceptanceReadiness',{principalId:who.principalId,operationId:p.operationId,requestHash:p.requestHash}),b=await basis(who);
    const stable=await original(who,p.operationId),same=stable.revision===p.revision&&stable.resolution===p.resolution&&stable.qualification===p.qualification;
    const policyCurrent=b.configured&&b.policyHash===p.policyHash,unresolved=stable.resolution==='UNRESOLVED';
    return parseContract(acceptancePreparationView,{operationId:p.operationId,runId:p.runId,candidateId:p.candidateId,releaseId:p.releaseId,requestHash:p.requestHash,revision:p.revision,state:p.state,resolution:stable.resolution,qualification:stable.qualification,basis:Object.fromEntries(['candidateRevision','manifestHash','reviewHash','expectedAcceptedReleaseId','dataPlanHash'].map(k=>[k,p.request[k as keyof typeof p.request]])),createdAt:p.createdAt,updatedAt:p.updatedAt,acceptanceOperationId:stable.acceptanceOperationId,readiness:{state:ready.state,sequence:ready.sequence,proofHash:ready.proofHash,checkedAt:ready.observation?.checkedAt??null},resourceRevision:b.resourceRevision,canCommit:Boolean(same&&unresolved&&b.canManage&&policyCurrent&&commit&&stable.qualification==='CURRENT'&&ready.state==='READY'&&ready.proof?.service.claim.schemaVersion==='devmesh.acceptance-service-claim.v1'),canCloseUnsent:same&&unresolved&&b.canManage&&p.state==='PREPARED',canAbort:same&&unresolved&&b.canManage&&['SENT','UNKNOWN'].includes(p.state)&&b.currentAcceptedReleaseId===p.request.expectedAcceptedReleaseId});
  }
  function write(request:Request,who:{principalId:string;runId:string}){
    empty.parse(request.query);if(!request.is('application/json'))fail('CONTENT_TYPE_INVALID',415);
    const match=request.headers['if-match'];return {meta:{principalId:who.principalId,scopeId:who.runId,idempotencyKey:parseContract(idempotencyKey,request.headers['idempotency-key'])},runId:who.runId,...(match===undefined?{}:{ifMatch:parseContract(z.string().max(128),match)})};
  }
  router.get(base,guarded(async(request,response,identity)=>{empty.parse(request.query);const b=await basis(subject(request,identity));response.setHeader('ETag','"r'+b.resourceRevision+'"');response.json(b);}));
  router.get(base+'/view',guarded(async(request,response,identity)=>{empty.parse(request.query);const value=await basis(subject(request,identity)),page=acceptancePage(value);response.setHeader('Referrer-Policy','no-referrer');response.setHeader('Content-Security-Policy',page.policy);response.type('text/html; charset=utf-8').send(page.html);}));
  router.get(base+'/client.js',guarded(async(request,response,identity)=>{empty.parse(request.query);const who=subject(request,identity);await basis(who);const bytes=await readFile(new URL('./web/acceptance/acceptance-client.js',import.meta.url));await basis(who);response.type('application/javascript; charset=utf-8').send(bytes);}));
  router.get(base+'/preparations',guarded(async(request,response,identity)=>{const who=subject(request,identity),query=parseContract(page,request.query),list=await storage.request('listCandidateAcceptancePreparations',{...who,...query}),items=[];for(const item of list.items)items.push({sequence:item.sequence,preparation:await project(who,item.preparation)});await storage.request('getReleaseCandidate',who);response.json(parseContract(acceptancePreparationList,{items,nextSequence:list.nextSequence}));}));
  router.get(base+'/preparations/:operationId',guarded(async(request,response,identity)=>{empty.parse(request.query);const who=subject(request,identity),p=await original(who,parseContract(ids.operation,request.params.operationId)),value=await project(who,p);response.setHeader('ETag','"r'+value.resourceRevision+'"');response.json(value);}));
  router.post(base+'/preparations',guarded(async(request,response,identity)=>{
    const who=subject(request,identity),conditional=write(request,who),body=parseContract(beginAcceptanceInput,request.body),b=await basis(who);
    if(!b.canManage)fail('FORBIDDEN',403);
    if(!await storage.request('lookupOperation',conditional.meta)&&(!b.configured||body.policyHash!==b.policyHash))fail('ACCEPTANCE_UNAVAILABLE',503);
    const p=await storage.request('beginAcceptancePreparation',{...conditional,candidateId:who.candidateId,...body});response.status(202).json(await project(who,p));
  }));
  router.post(base+'/replacement-confirmations',guarded(async(request,response,identity)=>{const who=subject(request,identity),conditional=write(request,who),body=parseContract(confirmAcceptanceReplacementInput,request.body);response.status(201).json(parseContract(acceptanceReplacementReceipt,await storage.request('recordAcceptanceReplacementDecision',{...conditional,candidateId:who.candidateId,...body})));}));
  router.post(base+'/preparations/:operationId/close-unsent',guarded(async(request,response,identity)=>{const who=subject(request,identity),conditional=write(request,who),body=parseContract(closeUnsentAcceptanceInput,request.body),operationId=parseContract(ids.operation,request.params.operationId);await original(who,operationId);const p=await storage.request('failUnsentAcceptancePreparation',{...conditional,operationId,...body});response.json(await project(who,p));}));
  router.post(base+'/preparations/:operationId/abort',guarded(async(request,response,identity)=>{const who=subject(request,identity),conditional=write(request,who),body=parseContract(abortAcceptanceInput,request.body),preparationOperationId=parseContract(ids.operation,request.params.operationId);await original(who,preparationOperationId);const r=await storage.request('requestAcceptanceAbort',{...conditional,preparationOperationId,...body});response.status(202).json(parseContract(acceptanceAbortReceipt,{operationId:r.decision.operationId,preparationOperationId,decisionHash:r.decisionHash,reason:r.decision.reason,decidedAt:r.decision.decidedAt,decisionState:'RECORDED'}));}));
  router.post('/candidates/:candidateId\\:accept',guarded(async(request,response,identity)=>{
    const body=parseContract(acceptCandidateInput,request.body),who={principalId:identity.principalId,runId:body.runId,candidateId:parseContract(ids.candidate,request.params.candidateId)},conditional=write(request,who),p=await original(who,body.preparationOperationId),b=await basis(who);
    if(!b.canManage)fail('FORBIDDEN',403);const previous=await storage.request('lookupOperation',conditional.meta),input={...conditional,...body,candidateId:who.candidateId};
    if(!previous&&(!commit||!b.configured||b.policyHash!==p.policyHash))fail('ACCEPTANCE_UNAVAILABLE',503);
    const result=commit?await commit(input):previous?.status==='SUCCEEDED'?await storage.request('commitReleaseAcceptance',input):fail('ACCEPTANCE_UNAVAILABLE',503);
    response.status(202).json(parseContract(acceptanceCommitReceipt,{...result,links:{preparation:'/api/v1/runs/'+who.runId+'/candidates/'+who.candidateId+'/acceptance/preparations/'+p.operationId}}));
  }));
}
