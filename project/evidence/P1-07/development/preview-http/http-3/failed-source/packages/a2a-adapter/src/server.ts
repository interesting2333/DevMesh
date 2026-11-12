import { timingSafeEqual } from 'node:crypto';
import type { Express, Request, RequestHandler } from 'express';
import express from 'express';
import { AgentCard } from '@a2a-js/sdk';
import { agentCardHandler, jsonRpcHandler } from '@a2a-js/sdk/server/express';
import type { SqliteStorage, AgentManifest, EndpointConfig } from '@devmesh/storage-sqlite';
import { AgentRegistry, cardHash } from './registry.js';
import type { CredentialResolver } from './registry.js';
import { DurableRequestHandler } from './handler.js';
import type { ServiceIdentity } from './config.js';
export { loadInternalA2AConfig } from './config.js';
export type { ServiceIdentity, InternalA2AConfig } from './config.js';

export interface InternalA2AOptions { manifest:AgentManifest;identities:ServiceIdentity[];resolveCredential:CredentialResolver;healthIntervalMs?:number;projectionIntervalMs?:number }
export function createRoleCard(e:Pick<EndpointConfig,'agentKey'|'implementationVersion'|'address'|'streaming'|'supportedSkills'>):AgentCard{
 return AgentCard.fromJSON({name:e.agentKey,description:'DevMesh internal durable work endpoint',version:e.implementationVersion,supportedInterfaces:[{url:e.address,protocolBinding:'JSONRPC',protocolVersion:'1.0'}],capabilities:{streaming:e.streaming,pushNotifications:false},defaultInputModes:['application/json'],defaultOutputModes:['application/json'],skills:e.supportedSkills.map(id=>({id,name:id,description:'Accept authorized versioned work and expose its persisted Task',tags:['devmesh'],inputModes:['application/json'],outputModes:['application/json']})),securitySchemes:{serviceBearer:{httpAuthSecurityScheme:{scheme:'Bearer'}}},securityRequirements:[{schemes:{serviceBearer:{list:[]}}}]});
}
export const environmentCredentials=(env:NodeJS.ProcessEnv=process.env):CredentialResolver=>async ref=>env['DEVMESH_CREDENTIAL_'+ref.replaceAll(/[^a-zA-Z0-9]/g,'_').toUpperCase()];
export function mountInternalAgents(app:Express,storage:SqliteStorage,options:InternalA2AOptions){
 const registry=new AgentRegistry(storage),handlers=new Map<string,DurableRequestHandler>();
 let disposed=false,runningHealth:Promise<void>|undefined,runningProjection:Promise<void>|undefined;
 const authenticate=async(req:Request)=>{
  const authorization=req.headers.authorization;if(!authorization?.startsWith('Bearer '))return undefined;
  const presented=Buffer.from(authorization.slice(7));if(presented.length>4096)return undefined;
  for(const i of options.identities){const secret=await options.resolveCredential(i.credentialRef);if(!secret||secret.length<16)continue;const expected=Buffer.from(secret);if(expected.length===presented.length&&timingSafeEqual(expected,presented))return i.principalId;}return undefined;
 };
 const auth:RequestHandler=async(req,res,next)=>{try{const principal=await authenticate(req);if(!principal){res.set('WWW-Authenticate','Bearer').status(401).json({error:'SERVICE_AUTH_REQUIRED'});return;}res.locals.a2aPrincipal=principal;next();}catch{res.status(503).json({error:'SERVICE_AUTH_UNAVAILABLE'});}};
 for(const e of options.manifest.endpoints.filter(e=>e.hosting==='local')){
  const card=createRoleCard(e);if(cardHash(card)!==e.cardHash)throw new Error('Configured cardHash does not match hosted card: '+e.endpointId);
  const path=e.role?'/internal/agents/'+e.role:'/internal/services/'+encodeURIComponent(e.agentKey);
  if(new URL(e.address).pathname!==path+'/a2a'||new URL(e.cardUrl).pathname!==path+'/agent-card.json')throw new Error('Local endpoint path differs from hosted route');
  const handler=new DurableRequestHandler(storage,registry,e,card);handlers.set(e.endpointId,handler);
  // SDK 1.3's Card middleware JSON-serializes the supplied object directly.
  // Convert protobuf oneofs through its codec at this transport boundary.
  app.use(path+'/agent-card.json',auth,agentCardHandler({agentCardProvider:async()=>AgentCard.toJSON(card) as AgentCard}));
  app.use(path+'/a2a',auth,express.json({limit:'128kb'}),jsonRpcHandler({requestHandler:handler,userBuilder:async req=>{
   const userName=String(req.res!.locals.a2aPrincipal),controller=new AbortController();req.res!.once('close',()=>controller.abort());return {isAuthenticated:true,userName,signal:controller.signal};
  }}));
 }
 let healthTimer:NodeJS.Timeout|undefined,projectionTimer:NodeJS.Timeout|undefined;
 return {registry,handlers,
  async activate(){
   if(disposed)throw new Error('A2A service was closed');
   await storage.request('recoverAcceptedWork',{});
   await registry.reconcile(options.manifest,options.resolveCredential);
   healthTimer=setInterval(()=>{if(!runningHealth)runningHealth=registry.checkHealth(options.manifest,options.resolveCredential).catch(()=>{registry.closeAdmission();}).finally(()=>{runningHealth=undefined;});},options.healthIntervalMs??60000);healthTimer.unref();
   projectionTimer=setInterval(()=>{if(!runningProjection)runningProjection=(async()=>{const current=await storage.request('getRegistrySnapshot',{});if(!registry.ready||current.generationId!==registry.version.generationId||current.projectionRevision!==registry.version.projectionRevision)await registry.refresh();})().catch(()=>{registry.closeAdmission();}).finally(()=>{runningProjection=undefined;});},options.projectionIntervalMs??5000);projectionTimer.unref();
  },
  async stop(){disposed=true;registry.closeAdmission();clearInterval(healthTimer);clearInterval(projectionTimer);await Promise.allSettled([runningHealth,runningProjection]);},
 };
}
