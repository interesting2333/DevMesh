import {setTimeout as delay} from 'node:timers/promises';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {SqliteStorage,ReleasePublication,ReleasePublicationBackend} from '@devmesh/storage-sqlite';
import {ReleasePublisher} from './release-publisher.js';

export interface ReleasePublicationBinding {
 projectId:string;policyHash:string;principalId:string;backendRef:string;runnerId:string;
 backend:ReleasePublicationBackend;
}
export interface ReleasePublicationConsumerOptions {
 bindings:readonly ReleasePublicationBinding[];pollIntervalMs?:number;
 maxConcurrentProjects?:number;maxScopesPerPass?:number;pageSize?:number;
}
type Scope={binding:Readonly<ReleasePublicationBinding>;publisher:ReleasePublisher;cursor:number};
const invalid=():never=>{throw new StorageError('RELEASE_CONSUMER_CONFIG_INVALID',422,'Explicit bounded trusted publication bindings are required');};

/** Consumes only already accepted original Outbox records. No T5 or data migration. */
export class ReleasePublicationConsumer {
 readonly #stop=new AbortController();
 readonly #scopes:Scope[];
 readonly #limits:{pollIntervalMs:number;maxConcurrentProjects:number;maxScopesPerPass:number;pageSize:number};
 #nextScope=0;
 #loop:Promise<void>|undefined;
 #pass:Promise<void>|undefined;
 #drain:Promise<void>|undefined;
 lastError:string|null=null;

 private constructor(readonly storage:Pick<SqliteStorage,'request'>,options:ReleasePublicationConsumerOptions){
  const limit=(v:number|undefined,fallback:number,min:number,max:number)=>{const n=v??fallback;if(!Number.isSafeInteger(n)||n<min||n>max)invalid();return n;};
  if(!Array.isArray(options.bindings)||options.bindings.length<1||options.bindings.length>32)invalid();
  this.#limits={pollIntervalMs:limit(options.pollIntervalMs,5000,1000,30000),maxConcurrentProjects:limit(options.maxConcurrentProjects,2,1,2),maxScopesPerPass:limit(options.maxScopesPerPass,32,1,32),pageSize:limit(options.pageSize,1,1,20)};
  const projects=new Set<string>();
  this.#scopes=options.bindings.map(input=>{
   const binding=Object.freeze({projectId:ids.project.parse(input.projectId),policyHash:sha256.parse(input.policyHash),principalId:opaqueKey.parse(input.principalId),backendRef:opaqueKey.parse(input.backendRef),runnerId:opaqueKey.parse(input.runnerId),backend:input.backend});
   const backend=binding.backend;
   if(projects.has(binding.projectId)||!backend?.configured||['preflight','publish','inspect'].some(k=>typeof backend[k as keyof ReleasePublicationBackend]!=='function')||backend.resume!==undefined&&typeof backend.resume!=='function')invalid();
   projects.add(binding.projectId);
   const check=(p:ReleasePublication)=>{const q=p.request.preparation;if(p.projectId!==binding.projectId||q.projectId!==binding.projectId||q.policyHash!==binding.policyHash||q.backendPrincipalId!==binding.principalId||q.backendRef!==binding.backendRef||q.runnerId!==binding.runnerId)throw new StorageError('RELEASE_RECOVERY_SCOPE_CHANGED',409,'Original publication binding changed');};
   const preflight=backend.preflight.bind(backend),publish=backend.publish.bind(backend),inspect=backend.inspect.bind(backend),resume=backend.resume?.bind(backend);
   const scoped:ReleasePublicationBackend={get configured(){return backend.configured;},async preflight(p){check(p);await preflight(p);},async publish(p,authorize){check(p);return publish(p,authorize);},async inspect(p){check(p);return inspect(p);},...(resume?{async resume(p:ReleasePublication,authorize:()=>Promise<boolean>){check(p);return resume(p,authorize);}}:{})};
   return {binding,publisher:new ReleasePublisher(storage,binding.principalId,scoped),cursor:0};
  });
 }

 static async create(storage:Pick<SqliteStorage,'request'>,options:ReleasePublicationConsumerOptions):Promise<ReleasePublicationConsumer>{
  const consumer=new ReleasePublicationConsumer(storage,options);
  for(const {binding:b} of consumer.#scopes){const {policy}=await storage.request('getAcceptancePreparationScope',{principalId:b.principalId,projectId:b.projectId,policyHash:b.policyHash});if(policy.backendPrincipalId!==b.principalId||policy.backendRef!==b.backendRef||policy.runnerId!==b.runnerId)invalid();}
  return consumer;
 }

 tick():Promise<void>{if(this.#stop.signal.aborted)return Promise.resolve();return this.#pass??=this.consume().finally(()=>{this.#pass=undefined;});}
 private async consume():Promise<void>{
  const count=Math.min(this.#limits.maxScopesPerPass,this.#scopes.length),scopes=Array.from({length:count},(_,i)=>this.#scopes[(this.#nextScope+i)%this.#scopes.length]!);this.#nextScope=(this.#nextScope+count)%this.#scopes.length;
  for(let i=0;i<scopes.length&&!this.#stop.signal.aborted;i+=this.#limits.maxConcurrentProjects)await Promise.all(scopes.slice(i,i+this.#limits.maxConcurrentProjects).map(scope=>this.consumeScope(scope)));
 }
 private async consumeScope(scope:Scope):Promise<void>{
  const {binding:b}=scope;
  try{
   if(this.#stop.signal.aborted)return;
   if(!b.backend.configured)throw new StorageError('RELEASE_PUBLICATION_BACKEND_NOT_CONFIGURED',503,'Original publication backend unavailable');
   const page=await this.storage.request('listReleasePublicationWork',{principalId:b.principalId,projectId:b.projectId,policyHash:b.policyHash,afterSequence:scope.cursor,limit:this.#limits.pageSize});scope.cursor=page.nextSequence??0;
   for(const {publication:p} of page.items){if(this.#stop.signal.aborted)return;if(p.projectId!==b.projectId||p.request.preparation.policyHash!==b.policyHash)throw new StorageError('RELEASE_RECOVERY_SCOPE_CHANGED',409,'Original publication work changed');try{await scope.publisher.advance(p.releaseId,this.#stop.signal);}catch(error){this.recordError(error);}}
  }catch(error){this.recordError(error);}
 }
 private recordError(error:unknown):void{if(this.#stop.signal.aborted)return;const code=error instanceof StorageError?error.code:'';this.lastError=/^[A-Z][A-Z0-9_]{0,95}$/.test(code)?code:'RELEASE_RECOVERY_UNAVAILABLE';}
 start():void{
  if(this.#loop||this.#stop.signal.aborted)throw new Error('Release publication consumer can only start once');
  this.#loop=(async()=>{while(!this.#stop.signal.aborted){await this.tick();try{await delay(this.#limits.pollIntervalMs,undefined,{signal:this.#stop.signal});}catch{break;}}})();
 }
 stopAdmission():void{this.#stop.abort();}
 stop():Promise<void>{this.stopAdmission();return this.#drain??=Promise.all([this.#loop,this.#pass]).then(()=>{});}
}
