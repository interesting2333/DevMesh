import type {WorkbenchDirectoryAccess} from './workbench-spaces.js';
import {z} from 'zod';
import {conversationCreate,conversationInput,conversationControl,conversationCapabilities,conversationRename,conversationConfirm,conversationDelete,conversationDeletionState,conversationWorkContext,parseContract,opaqueKey,idempotencyKey} from '@devmesh/contracts';
import type {Router,Request,Response,RequestHandler} from 'express';
import type {LocalContentStore} from '@devmesh/blob-store';
import {StorageError} from '@devmesh/storage-sqlite';
import type {OperationResult} from '@devmesh/storage-sqlite';
import type {Identity} from './index.js';
export interface ConversationAccess {
 admission?:()=>boolean;
 capabilities():z.output<typeof conversationCapabilities>;
 control(principalId:string,conversationId:string,body:z.output<typeof conversationControl>,key:string):Promise<OperationResult>;
}
type Route=(handler:(request:Request,response:Response,identity:Identity)=>Promise<void>)=>RequestHandler;
export function mountConversationRoutes(router:Router,content:LocalContentStore,route:Route,access?:ConversationAccess,directories?:WorkbenchDirectoryAccess){
 const intake=()=>{if(access?.admission?.()===false)throw new StorageError('CONVERSATION_ADMISSION_CLOSED',503,'New conversation inputs are disabled');};
 const readId=(r:Request)=>parseContract(opaqueKey,r.params.conversationId);
 const key=(r:Request)=>parseContract(idempotencyKey,r.headers['idempotency-key']);
 const body=(r:Request)=>{if(!r.is('application/json'))throw new StorageError('CONTENT_TYPE_INVALID',415,'JSON required');return r.body;};
 router.get('/conversation-capabilities',route(async(_req,res)=>{res.json(parseContract(conversationCapabilities,access?.capabilities()??{model:false,preparation:false,execution:false,reason:'MODEL_NOT_CONFIGURED'}));}));
 router.post('/conversations',route(async(req,res,identity)=>{intake();const bodyValue=parseContract(conversationCreate,body(req)),meta={principalId:identity.principalId,scopeId:'conversations.create',idempotencyKey:key(req)},original=await content.storage.request('lookupOperation',meta);let binding,spaceRevision;if(!original){const listed=await content.storage.request('listWorkbenchSpaces',{principalId:identity.principalId}),space=await content.storage.request('getWorkbenchSpace',{principalId:identity.principalId,spaceId:bodyValue.spaceId??listed.legacySpaceId});spaceRevision=space.revision;if(space.directory){if(!directories)throw new StorageError('WORKBENCH_DIRECTORY_UNAVAILABLE',409,'Directory backend is unavailable');binding=await directories.inspect(space.directory.path);}else binding=null;}res.status(201).json(await content.storage.request('createConversation',{meta,body:bodyValue,...(binding===undefined?{}:{binding}),...(spaceRevision===undefined?{}:{spaceRevision})}));}));
 router.get('/conversations',route(async(req,res,identity)=>{const q=parseContract(z.strictObject({spaceId:opaqueKey.optional(),query:z.string().max(80).optional(),before:z.string().max(200).optional(),limit:z.coerce.number().int().min(1).max(100).default(30)}),req.query);res.json(await content.storage.request('listConversations',{principalId:identity.principalId,...q}));}));
 router.get('/conversations/:conversationId',route(async(req,res,identity)=>{const q=parseContract(z.strictObject({afterSeq:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(100).default(50)}),req.query);res.json(await content.storage.request('getConversation',{principalId:identity.principalId,conversationId:readId(req),...q}));}));
 router.post('/conversations/:conversationId/messages',route(async(req,res,identity)=>{intake();const id=readId(req);res.status(202).json(await content.storage.request('appendConversationMessage',{meta:{principalId:identity.principalId,scopeId:id,idempotencyKey:key(req)},conversationId:id,body:parseContract(conversationInput,body(req))}));}));
 router.post('/conversations/:conversationId/control',route(async(req,res,identity)=>{if(!access)throw new StorageError('SERVICE_UNAVAILABLE',503,'Conversation Runtime is unavailable');res.status(202).json(await access.control(identity.principalId,readId(req),parseContract(conversationControl,body(req)),key(req)));}));
 router.post('/conversations/:conversationId/rename',route(async(req,res,identity)=>{const id=readId(req);res.status(202).json(await content.storage.request('renameConversation',{meta:{principalId:identity.principalId,scopeId:id,idempotencyKey:key(req)},conversationId:id,body:parseContract(conversationRename,body(req))}));}));
 router.get('/conversations/:conversationId/deletion-state',route(async(req,res,identity)=>{res.json(parseContract(conversationDeletionState,await content.storage.request('getConversationDeletionState',{principalId:identity.principalId,conversationId:readId(req)})));}));
 router.post('/conversations/:conversationId/deletions',route(async(req,res,identity)=>{const id=readId(req);res.status(202).json(await content.storage.request('deleteConversation',{meta:{principalId:identity.principalId,scopeId:id,idempotencyKey:key(req)},conversationId:id,body:parseContract(conversationDelete,body(req))}));}));
 router.post('/conversations/:conversationId/plan-confirmations',route(async(req,res,identity)=>{intake();const id=readId(req);res.status(202).json(await content.storage.request('confirmConversationPlan',{meta:{principalId:identity.principalId,scopeId:id,idempotencyKey:key(req)},conversationId:id,body:parseContract(conversationConfirm,body(req))}));}));
 router.get('/conversations/:conversationId/work-context',route(async(req,res,identity)=>{
  const target={principalId:identity.principalId,conversationId:readId(req)},first=(await content.storage.request('getConversation',{...target,limit:1})).conversation;
  if(!first.projectId||!first.runId){res.json(null);return;}
  const selected={principalId:identity.principalId,projectId:first.projectId,runId:first.runId,limit:1};
  const workspace=await content.storage.request('getInputWorkspace',selected);
  const [understanding,plan,facts]=await Promise.all([
   content.storage.request('getUnderstanding',{principalId:identity.principalId,runId:first.runId}),
   workspace.run.currentPlanRevision?content.storage.request('getPlanReview',{principalId:identity.principalId,runId:first.runId}):Promise.resolve(null),
   content.storage.request('getConversationExecutionFacts',target),
  ]);
  const lastWorkspace=await content.storage.request('getInputWorkspace',selected),last=(await content.storage.request('getConversation',{...target,limit:1})).conversation;
  if(first.runId!==last.runId||first.projectId!==last.projectId||first.inputRevision!==last.inputRevision||JSON.stringify(workspace.run)!==JSON.stringify(lastWorkspace.run)||JSON.stringify(workspace.project)!==JSON.stringify(lastWorkspace.project))throw new StorageError('BASIS_SUPERSEDED',409,'Work context changed during read');
  res.json(parseContract(conversationWorkContext,{conversationId:first.conversationId,inputRevision:first.inputRevision,project:{projectId:workspace.project.projectId,name:workspace.project.name},run:{runId:workspace.run.runId,resourceRevision:workspace.run.resourceRevision,phase:workspace.run.phase,controlGate:workspace.run.controlGate,terminalOutcome:workspace.run.terminalOutcome,currentPlanRevision:workspace.run.currentPlanRevision,currentRequirementRevision:workspace.run.currentRequirementRevision},understanding,plan,works:facts.works}));
 }));
 router.get('/conversation-operations/:key',route(async(req,res,identity)=>{
  const q=parseContract(z.strictObject({scope:opaqueKey}),req.query),originalKey=parseContract(idempotencyKey,req.params.key);
  const result=q.scope==='conversations.create'?await content.storage.request('lookupOperation',{principalId:identity.principalId,scopeId:q.scope,idempotencyKey:originalKey}):await content.storage.request('lookupConversationOperation',{principalId:identity.principalId,conversationId:q.scope,idempotencyKey:originalKey});if(!result)throw new StorageError('RESOURCE_NOT_FOUND',404,'Original command not found');res.json(result);
 }));
}
