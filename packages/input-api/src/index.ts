import express from 'express';
import {mountExportRoutes} from './export.js';
import {mountReviewRoutes} from './review.js';
import {mountAcceptanceRoutes} from './acceptance.js';
import type {AcceptanceAccess} from './acceptance.js';
export type {AcceptanceAccess} from './acceptance.js';
import type { Express, Request, Response, NextFunction } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createProjectInput,createTaskInput,saveMessageInput,answerQuestionsInput,retryUnderstandingInput,commandBodies,idempotencyKey,ids,opaqueKey,parseContract,gitCommit,ContractError,errorCode } from '@devmesh/contracts';
import { canonical, StorageError } from '@devmesh/storage-sqlite';
import type { OperationResult } from '@devmesh/storage-sqlite';
import type { LocalContentStore } from '@devmesh/blob-store';
import { receiveUpload } from './upload.js';
import {mountReleaseRoutes} from './release.js';
import type {ReleaseAccessGateway} from './release.js';
export type {ReleaseAccessGateway} from './release.js';
import {mountPreviewRoutes} from './preview.js';
import {mountPreviewManagementRoutes} from './preview-management.js';
import {mountWorkbenchRoutes} from './workbench.js';
import type {PreviewAccessGateway} from './preview.js';
import {createInputAuthenticator} from './input-auth.js';
import type {Identity,IdentityResolver} from './input-auth.js';
export type {Identity,IdentityResolver} from './input-auth.js';
import {createWorkbenchEventServer} from './workbench-events-server.js';
import type {WorkbenchEventLimits} from './workbench-events-server.js';
export type {WorkbenchEventLimits} from './workbench-events-server.js';
export type {PreviewAccessGateway} from './preview.js';

export interface TemplateBaseline { readonly version:string;readonly baseCommit:string }
export type InputApiOptions={enabled?:false}|{
  enabled:true; identityResolver?:IdentityResolver|undefined; baseline:TemplateBaseline;
  previewGateway?:PreviewAccessGateway|undefined;
  previewPolicies?:Readonly<Record<string,string>>|undefined;
  releaseGateway?:ReleaseAccessGateway|undefined;
  acceptance?:AcceptanceAccess|undefined;
  events?:WorkbenchEventLimits|undefined;
  maximumUploads?:number;diagnostic?:(detail:{requestId:string;error:unknown})=>void;
};
const runFile=promisify(execFile);
/** Resolve from a trusted repository, never a client path or commit field. */
export async function resolveTemplateBaseline(repositoryRoot:string,commit:string,templatePath='templates/web-crud-v1'):Promise<TemplateBaseline>{
  parseContract(gitCommit,commit);
  if(!/^[A-Za-z0-9][A-Za-z0-9_/-]*$/.test(templatePath)||templatePath.split('/').some(p=>p==='..'))throw new Error('Invalid trusted template path');
  const {stdout:resolved}=await runFile('git',['rev-parse','--verify',`${commit}^{commit}`],{cwd:repositoryRoot,timeout:30000,maxBuffer:1024});
  if(resolved.trim()!==commit)throw new Error('Template commit was not resolved exactly');
  const {stdout}=await runFile('git',['show',`${commit}:${templatePath}/template.json`],{cwd:repositoryRoot,timeout:30000,maxBuffer:64*1024});
  const manifest=JSON.parse(stdout) as {templateId?:unknown;revision?:unknown};
  const version=manifest.revision;
  if(typeof version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(version))throw new Error('Template version is missing');
  return Object.freeze({version,baseCommit:commit});
}
function fail(code:string,status:number,message:string):never{throw new StorageError(code,status,message);}
const scalar=(value:unknown,name:string):string=>typeof value==='string'?value:fail('SCHEMA_INVALID',422,`${name} must occur once`);
const positive=(value:unknown,fallback:number,max:number)=>{
  if(value===undefined)return fallback;
  const text=scalar(value,'limit');if(!/^\d+$/.test(text)||Number(text)<1||Number(text)>max)fail('SCHEMA_INVALID',422,'Invalid page size');return Number(text);
};
const scopeMeta=(principalId:string,scopeId:string,request:Request)=>({principalId,scopeId,idempotencyKey:parseContract(idempotencyKey,request.headers['idempotency-key'])});

export function mountInputApi(app:Express,content:LocalContentStore,options:InputApiOptions={enabled:false}){
  if(!options.enabled)return {enabled:false as const,stopAdmission:()=>{},stop:async()=>{}};
  parseContract(gitCommit,options.baseline.baseCommit);parseContract(opaqueKey,options.baseline.version);
  const baseline=Object.freeze({...options.baseline}),maximumUploads=options.maximumUploads??4;
  if(!Number.isInteger(maximumUploads)||maximumUploads<1||maximumUploads>8)throw new Error('maximumUploads must be 1..8');
  const auth=createInputAuthenticator(options.identityResolver),events=createWorkbenchEventServer(content,auth,options.events);
  let accepting=true,activeUploads=0;
  const pending=new Map<Promise<void>,Request>();
  const router=express.Router(),identities=new WeakMap<Request,Identity>(),requestIds=new WeakMap<Request,string>();
  const route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>(request:Request,response:Response,next:NextFunction)=>{
    const work=Promise.resolve().then(()=>{if(!accepting)fail('SERVICE_STOPPING',503,'Input API is stopping');return handler(request,response,identities.get(request)!);});
    pending.set(work,request);work.catch(next).finally(()=>{pending.delete(work);});
  };
  router.use((request,response,next)=>{
    const requestId=`req_${randomUUID().replaceAll('-','')}`;requestIds.set(request,requestId);
    response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('X-Request-Id',requestId);
    const work=(async()=>{try{
      if(!accepting)fail('SERVICE_STOPPING',503,'Input API is stopping');
       const {principalId}=await auth.authenticate(request);
       if(!accepting)fail('SERVICE_STOPPING',503,'Input API is stopping');
       identities.set(request,{principalId});next();
    }catch(error){next(error);}})();
    pending.set(work,request);void work.finally(()=>{pending.delete(work);});
  });
  router.use(express.json({limit:256*1024,strict:true,type:'application/json'}));
  const bodyMeta=(request:Request,scope:string,identity:Identity)=>scopeMeta(identity.principalId,scope,request);
  const json=(request:Request)=>{if(!request.is('application/json'))fail('CONTENT_TYPE_INVALID',415,'Expected application/json');return request.body as unknown;};
  const putBody=async(principalId:string,scopeId:string,key:string,text:string)=>{
    // A separate deterministic operation namespace protects content publication.
    const bytes=Buffer.from(text,'utf8'),hash=createHash('sha256').update(bytes).digest('hex');
    await content.putBytes({principalId,scopeId:`body.${scopeId}`,idempotencyKey:key},{kind:'content'},bytes,'text/plain; charset=utf-8');return hash;
  };
  const receipt=(operation:OperationResult)=>{
    const result=operation.result;if(!result||typeof result.projectId!=='string'||typeof result.runId!=='string'||typeof result.revision!=='number')fail('SERVICE_UNAVAILABLE',503,'Original operation receipt is unavailable');
    return {...operation,resource:{projectId:result.projectId,runId:result.runId,revision:result.revision},links:{operation:`/api/v1/operations/${operation.operationId}`}};
  };
  const controlRevisionOf=(request:Request)=>{
    const ifMatch=request.headers['if-match'];
    if(ifMatch===undefined)fail('PRECONDITION_REQUIRED',428,'If-Match control revision is required');
    const match=/^"r([1-9]\d*)"$/.exec(scalar(ifMatch,'If-Match'));
    if(!match)fail('PRECONDITION_INVALID',428,'If-Match must be the current control revision');
    return Number(match[1]);
  };
  router.post('/attachments',route(async(request,response,identity)=>{
    const meta=bodyMeta(request,'uploads',identity);
    if(activeUploads>=maximumUploads)fail('UPLOAD_CAPACITY',429,'Upload capacity is full');
    activeUploads++;
    try{
      const intake=await receiveUpload(request,content,identity.principalId,meta.idempotencyKey);
      if(intake.state!=='READY'||!intake.attachmentId)fail('UPLOAD_IN_PROGRESS',409,'Query the original upload result');
      const attachment=await content.storage.request('getInputAttachment',{principalId:identity.principalId,attachmentId:intake.attachmentId});
      response.status(201).json({attachment,operationId:intake.operationId});
    }finally{activeUploads--;}
  }));
  router.get('/attachments/:attachmentId',route(async(request,response,identity)=>{
    const attachmentId=parseContract(ids.attachment,request.params.attachmentId);
    response.json(await content.storage.request('getInputAttachment',{principalId:identity.principalId,attachmentId}));
  }));
  router.get('/attachments/:attachmentId/content',route(async(request,response,identity)=>{
    const attachmentId=parseContract(ids.attachment,request.params.attachmentId),principalId=identity.principalId;
    const attachment=await content.storage.request('getInputAttachment',{principalId,attachmentId});if(attachment.state!=='READY')fail('RESOURCE_NOT_FOUND',404,'Attachment has been removed');
    const bytes=await content.readBytes(principalId,{kind:'attachment',attachmentId},2*1024*1024);
    await content.storage.request('getInputAttachment',{principalId,attachmentId});
    response.type('text/plain; charset=utf-8').setHeader('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);response.send(Buffer.from(bytes));
  }));
  router.delete('/attachments/:attachmentId',route(async(request,response,identity)=>{
    response.json(await content.storage.request('removeInputAttachment',{principalId:identity.principalId,attachmentId:parseContract(ids.attachment,request.params.attachmentId)}));
  }));
  router.post('/projects',route(async(request,response,identity)=>{
    const body=parseContract(createProjectInput,json(request)),meta=bodyMeta(request,'projects.create',identity);
    const name=body.name??([...body.initialRequest.text.trim()].slice(0,40).join('')||'新项目');
    const bodyHash=await putBody(identity.principalId,'projects.create',meta.idempotencyKey,body.initialRequest.text);
    const operation=await content.storage.request('createInputProject',{meta,name,baseCommit:baseline.baseCommit,bodyHash,attachmentIds:body.initialRequest.attachmentIds,clientDraftId:body.clientDraftId});
    response.status(201).json(receipt(operation));
  }));
  router.post('/projects/:projectId/tasks',route(async(request,response,identity)=>{
    const body=parseContract(createTaskInput,json(request)),projectId=parseContract(ids.project,request.params.projectId),meta=bodyMeta(request,projectId,identity);
    // Authorize before a potentially durable content write; commit rechecks it.
    await content.storage.request('checkInputAccess',{principalId:identity.principalId,projectId,write:true});
    const bodyHash=await putBody(identity.principalId,projectId,meta.idempotencyKey,body.goal.text);
    response.status(201).json(receipt(await content.storage.request('createInputTask',{meta,projectId,bodyHash,body,...(request.headers['if-match']!==undefined?{ifMatch:scalar(request.headers['if-match'],'If-Match')}:{})})));
  }));
  router.post('/runs/:runId/messages',route(async(request,response,identity)=>{
    const body=parseContract(saveMessageInput,json(request)),runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity);
    // A scoped lookup checks visibility before publishing body bytes.
    await content.storage.request('checkInputAccess',{principalId:identity.principalId,runId,write:true});
    const bodyHash=await putBody(identity.principalId,runId,meta.idempotencyKey,body.text);
    response.status(202).json(receipt(await content.storage.request('appendInputMessage',{meta,runId,bodyHash,body,...(request.headers['if-match']!==undefined?{ifMatch:scalar(request.headers['if-match'],'If-Match')}:{})})));
  }));
  router.get('/runs/:runId/understanding',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId);
    const requirementRevision=request.query.requirementRevision===undefined?undefined:positive(request.query.requirementRevision,1,Number.MAX_SAFE_INTEGER);
    response.json(await content.storage.request('getUnderstanding',{runId,principalId:identity.principalId,...(requirementRevision===undefined?{}:{requirementRevision})}));
  }));
  router.post('/runs/:runId/questions\\:answer',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity),body=parseContract(answerQuestionsInput,json(request));
    const ifMatch=request.headers['if-match'];
    response.status(202).json(receipt(await content.storage.request('answerPreparationQuestions',{meta,runId,body,...(ifMatch===undefined?{}:{ifMatch:scalar(ifMatch,'If-Match')})})));
  }));
  router.post('/runs/:runId/understanding\\:retry',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity),body=parseContract(retryUnderstandingInput,json(request));
    const ifMatch=request.headers['if-match'];
    response.status(202).json(receipt(await content.storage.request('retryPreparationInterpretation',{meta,runId,...body,...(ifMatch===undefined?{}:{ifMatch:scalar(ifMatch,'If-Match')})})));
  }));
  router.get('/runs/:runId/plans',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId);
    const planRevision=request.query.revision===undefined?undefined:positive(request.query.revision,1,Number.MAX_SAFE_INTEGER);
    const review=await content.storage.request('getPlanReview',{runId,principalId:identity.principalId,...(planRevision===undefined?{}:{planRevision})});
    if(review.mode==='current')response.setHeader('ETag',`"r${review.resourceRevision}"`);
    response.json(review);
  }));
  router.post('/runs/:runId/plans/:planRevision\\:confirm',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity),body=parseContract(commandBodies.ConfirmPlan,json(request));
    const planRevision=positive(request.params.planRevision,1,Number.MAX_SAFE_INTEGER),ifMatch=request.headers['if-match'];
    response.status(202).json(receipt(await content.storage.request('confirmReviewedPlan',{meta,runId,planRevision,...body,...(ifMatch===undefined?{}:{ifMatch:scalar(ifMatch,'If-Match')})})));
  }));
  router.post('/runs/:runId\\:pause',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity),body=parseContract(commandBodies.PauseRun,json(request)),controlRevision=controlRevisionOf(request);
    await content.storage.request('checkInputAccess',{principalId:identity.principalId,runId,write:true});
    response.status(202).json(receipt(await content.storage.request('pauseRun',{meta,runId,controlRevision,...(body.reason===undefined?{}:{reason:body.reason})})));
  }));
  router.post('/runs/:runId\\:cancel',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity),body=parseContract(commandBodies.CancelRun,json(request)),controlRevision=controlRevisionOf(request);
    await content.storage.request('checkInputAccess',{principalId:identity.principalId,runId,write:true});
    response.status(202).json(receipt(await content.storage.request('cancelRun',{meta,runId,controlRevision,impactReviewHash:body.impactReviewHash})));
  }));
  router.post('/runs/:runId\\:resume',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId),meta=bodyMeta(request,runId,identity),body=parseContract(commandBodies.ResumeRun,json(request));
    await content.storage.request('checkInputAccess',{principalId:identity.principalId,runId,write:true});
    response.status(202).json(receipt(await content.storage.request('resumeRun',{meta,runId,controlRevision:body.controlRevision,recoveryReviewHash:body.recoveryReviewHash})));
  }));
  router.get('/runs/:runId/control',route(async(request,response,identity)=>{
    const runId=parseContract(ids.run,request.params.runId);
    await content.storage.request('checkInputAccess',{principalId:identity.principalId,runId,write:false});
    response.json(await content.storage.request('getControlStatus',{runId}));
  }));
  router.get('/operations/lookup',route(async(request,response,identity)=>{
    const includeAbsence=request.query.includeAbsence===undefined?'false':scalar(request.query.includeAbsence,'includeAbsence');
    if(!['true','false'].includes(includeAbsence))fail('SCHEMA_INVALID',422,'Invalid absence selection');
    const scope=parseContract(opaqueKey,request.query.scope),key=parseContract(idempotencyKey,request.query.key);
    const result=await content.storage.request('lookupInputOperation',{principalId:identity.principalId,scopeId:scope,idempotencyKey:key});
    if(includeAbsence==='true'){response.json({principalId:identity.principalId,scope,key,operation:result});return;}
    if(!result)fail('RESOURCE_NOT_FOUND',404,'Original operation has not been recorded');response.json(result);
  }));
  router.get('/operations/:operationId',route(async(request,response,identity)=>{
    response.json(await content.storage.request('getInputOperation',{principalId:identity.principalId,operationId:parseContract(ids.operation,request.params.operationId)}));
  }));
  router.get('/projects',route(async(request,response,identity)=>{
    let cursor:{updatedAt:string;projectId:string}|undefined;
    if(request.query.cursor!==undefined){try{const encoded=scalar(request.query.cursor,'cursor');if(encoded.length>1024)throw new Error();const value=Buffer.from(encoded,'base64url').toString('utf8');if(value.length>512)throw new Error();cursor=JSON.parse(value) as typeof cursor;}catch{fail('SCHEMA_INVALID',422,'Invalid project cursor');}}
    const page=await content.storage.request('listInputProjects',{principalId:identity.principalId,limit:positive(request.query.limit,20,100),...(cursor?{cursor}:{})});
    response.json({...page,nextCursor:page.nextCursor?Buffer.from(canonical(page.nextCursor)).toString('base64url'):null});
  }));
  router.get('/projects/:projectId/workspace',route(async(request,response,identity)=>{
    const projectId=parseContract(ids.project,request.params.projectId),principalId=identity.principalId;
    const snapshot=await content.storage.request('getInputWorkspace',{principalId,projectId,...(request.query.runId!==undefined?{runId:parseContract(ids.run,request.query.runId)}:{}),...(request.query.afterMessageId!==undefined?{afterMessageId:scalar(request.query.afterMessageId,'afterMessageId')}:{}),limit:positive(request.query.limit,50,200)});
    const messages=[];
    for(const message of snapshot.messages)messages.push({...message,text:await content.readText(principalId,{kind:'artifact',artifactId:message.bodyArtifactId},256*1024)});
    // Recheck current membership after asynchronous immutable body reads, while
    // returning the original metadata/cursor snapshot rather than a mixed one.
    await content.storage.request('checkInputAccess',{principalId,projectId});
    response.setHeader('ETag',`"r${snapshot.run.resourceRevision}"`);response.json({...snapshot,messages,templateBaseline:baseline});
  }));
  router.get('/projects/:projectId/runs/:runId/events',route(async(request,response,identity)=>{
    const after=request.query.afterSeq===undefined?'0':scalar(request.query.afterSeq,'afterSeq');if(!/^\d+$/.test(after)||!Number.isSafeInteger(Number(after)))fail('SCHEMA_INVALID',422,'Invalid event cursor');
    response.json(await content.storage.request('listInputEvents',{principalId:identity.principalId,projectId:parseContract(ids.project,request.params.projectId),runId:parseContract(ids.run,request.params.runId),afterSeq:Number(after),limit:positive(request.query.limit,50,200)}));
  }));
  mountWorkbenchRoutes(router,content,route);
  mountPreviewRoutes(router,content,options.previewGateway,route);
  mountPreviewManagementRoutes(router,content,options.previewPolicies,route);
  mountExportRoutes(router,content,route);
  mountReviewRoutes(router,content,route);
  mountAcceptanceRoutes(router,content,options.acceptance,route);
  mountReleaseRoutes(router,content,options.releaseGateway,route);
  router.use((error:unknown,request:Request,response:Response,_next:NextFunction)=>{
    const framework=error as {type?:string;status?:number};
    const schemaFailure=error instanceof ContractError||Boolean(error&&typeof error==='object'&&'issues' in error);
    const originalStatus=error instanceof StorageError||error instanceof ContractError?error.status:framework.type==='entity.too.large'?413:framework.type==='entity.parse.failed'||schemaFailure?422:500;
    const candidate=error instanceof StorageError||error instanceof ContractError?error.code:framework.type==='entity.too.large'?'REQUEST_TOO_LARGE':framework.type==='entity.parse.failed'?'JSON_INVALID':schemaFailure?'SCHEMA_INVALID':'SERVICE_UNAVAILABLE';
    const recognized=errorCode.safeParse(candidate).success,code=recognized?candidate:'SERVICE_UNAVAILABLE',status=recognized?originalStatus:503;
    const requestId=requestIds.get(request)??`req_${randomUUID().replaceAll('-','')}`;
    try{options.diagnostic?.({requestId,error});}catch{/* Diagnostic sinks cannot change an HTTP result. */}
    if(!request.complete&&!response.headersSent){response.setHeader('Connection','close');response.once('finish',()=>request.destroy());}
    const details=error instanceof StorageError&&['PLAN_INVALID','PLAN_SUPERSEDED'].includes(code)?error.details:{};
    if(!response.headersSent&&!response.destroyed)response.status(status).json({error:{code,message:status>=500?'Service is unavailable; query the original operation before retrying':'Request could not be accepted',requestId,retryable:status>=500||status===429,details}});
  });
  app.use('/api/v1',router);
  function stopAdmission(){accepting=false;auth.stop();events.stopAdmission();}
  return {enabled:true as const,attachEvents:events.attach,publishModelProgress:events.publishModelProgress,stopAdmission,async stop(){
    stopAdmission();
    const timer=setTimeout(()=>{for(const request of pending.values())request.destroy();},10000);timer.unref();
    try{await Promise.all([events.stop(),Promise.allSettled(pending.keys())]);}finally{clearTimeout(timer);}
  }};
}
