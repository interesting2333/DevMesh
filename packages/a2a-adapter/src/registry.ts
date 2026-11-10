import { createHash } from 'node:crypto';
import { AgentCard } from '@a2a-js/sdk';
import { canonical, StorageError, agentManifest } from '@devmesh/storage-sqlite';
import type { SqliteStorage, AgentManifest, EndpointConfig, RegistrySnapshot, EndpointView } from '@devmesh/storage-sqlite';
import { parseContract } from '@devmesh/contracts';

export type CredentialResolver=(ref:string)=>Promise<string|undefined>;
export const cardHash=(card:AgentCard)=>createHash('sha256').update(canonical(AgentCard.toJSON(card))).digest('hex');
const freeze=<T>(value:T):Readonly<T>=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
export class AgentRegistry {
 #snapshot:Readonly<RegistrySnapshot>|undefined;
 constructor(readonly storage:SqliteStorage){}
 get ready(){return this.#snapshot!==undefined;}
 get version(){const s=this.#snapshot;if(!s?.generationId)throw new StorageError('REGISTRY_NOT_READY',503,'Registry projection is unavailable');return {generationId:s.generationId,projectionRevision:s.projectionRevision};}
 closeAdmission(){this.#snapshot=undefined;}
 async refresh(){
  try{for(let i=0;i<3;i++){const s=await this.storage.request('getRegistrySnapshot',{});if(!s.generationId)throw new StorageError('REGISTRY_NOT_READY',503,'No committed generation');const candidate=freeze(s),check=await this.storage.request('getRegistrySnapshot',{});if(check.generationId===s.generationId&&check.projectionRevision===s.projectionRevision){this.#snapshot=candidate;return;}}throw new StorageError('REGISTRY_BUSY',503,'Registry changed during projection construction');}
  catch(error){this.closeAdmission();throw error;}
 }
 async resolveRole(role:string):Promise<EndpointView>{
  const s=this.#snapshot,b=s?.bindings.find(b=>b.role===role);if(!s||!b)throw new StorageError('ROLE_UNAVAILABLE',503,'No committed role binding');
  const e=s.endpoints.find(e=>e.config.endpointId===b.endpointId&&e.config.revision===b.revision)!;
  try{return await this.storage.request('assertRegistryTarget',{...this.version,endpointId:b.endpointId,revision:b.revision,cardHash:e.config.cardHash});}
  catch(error){if(error instanceof StorageError&&error.code==='REGISTRY_PROJECTION_STALE')this.closeAdmission();throw error;}
 }
 async reconcile(manifestInput:unknown,resolveCredential:CredentialResolver,timeoutMs=3000){
  this.closeAdmission();const manifest=parseContract(agentManifest,manifestInput),before=await this.storage.request('getRegistrySnapshot',{});
  const checks=await Promise.all(manifest.endpoints.map(e=>this.probe(e,resolveCredential,timeoutMs)));
  await this.storage.request('commitRegistry',{manifest,expectedProjectionRevision:before.projectionRevision,checks});await this.refresh();
 }
 async probe(e:EndpointConfig,resolveCredential:CredentialResolver,timeoutMs=3000){
  const ticket=await this.storage.request('issueEndpointProbe',{endpoint:e});let status:'HEALTHY'|'UNHEALTHY'|'NEEDS_REVIEW'='UNHEALTHY',observedCardHash:string|null=null,errorCode:string|null=null;
  try{
   const token=await resolveCredential(e.credentialRef);if(!token)throw new StorageError('SERVICE_CREDENTIAL_UNAVAILABLE',503,'Service credential is not configured');
   const r=await fetch(e.cardUrl,{headers:{Authorization:'Bearer '+token,'A2A-Version':'1.0'},redirect:'error',signal:AbortSignal.timeout(timeoutMs)});if(!r.ok||!r.body)throw new StorageError('CARD_HTTP_FAILURE',503,'Agent card request failed');
   const reader=r.body.getReader();const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536)throw new StorageError('CARD_TOO_LARGE',413,'Agent card exceeds 64 KiB');chunks.push(value);}}finally{await reader.cancel();}
   const card=AgentCard.fromJSON(JSON.parse(Buffer.concat(chunks).toString('utf8')));observedCardHash=cardHash(card);
   const face=card.supportedInterfaces.find(i=>i.protocolBinding==='JSONRPC'&&i.protocolVersion==='1.0'&&i.url===e.address);
   const skills=card.skills.map(s=>s.id).sort(),expected=[...e.supportedSkills].sort();
   status=face&&card.version===e.implementationVersion&&Boolean(card.capabilities?.streaming)===e.streaming&&canonical(skills)===canonical(expected)&&observedCardHash===e.cardHash?'HEALTHY':'NEEDS_REVIEW';
   if(status!=='HEALTHY')errorCode='CARD_COMPATIBILITY_CHANGED';
  }catch(error){errorCode=error instanceof StorageError?error.code:'CARD_CHECK_FAILED';}
  const checkedAt=new Date().toISOString();return {checkId:ticket.checkId,status,observedCardHash,checkedAt,expiresAt:new Date(Date.now()+120000).toISOString(),errorCode};
 }
 async checkHealth(manifest:AgentManifest,credentials:CredentialResolver){for(const e of manifest.endpoints){const check=await this.probe(e,credentials);await this.storage.request('recordEndpointCheck',check);}await this.refresh();}
}
