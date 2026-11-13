import {setTimeout as delay} from 'node:timers/promises';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {StorageError} from '@devmesh/storage-sqlite';
import type {SqliteStorage,AcceptanceAbortRecoveryBackend} from '@devmesh/storage-sqlite';

export interface AcceptanceAbortBinding {
 projectId:string;policyHash:string;principalId:string;backendRef:string;runnerId:string;
 backend:AcceptanceAbortRecoveryBackend;
}
export interface AcceptanceAbortConsumerOptions {
 bindings:readonly AcceptanceAbortBinding[];pollIntervalMs?:number;
 maxConcurrentProjects?:number;maxScopesPerPass?:number;pageSize?:number;
}
type Scope={binding:Readonly<AcceptanceAbortBinding>;advance:AcceptanceAbortRecoveryBackend['advance'];cursor:number};
const invalid=():never=>{throw new StorageError('ACCEPTANCE_ABORT_CONSUMER_CONFIG_INVALID',422,'Explicit bounded trusted abort bindings are required');};

/** Consumes already recorded original aborts only; no new owner decision or T5. */
export class AcceptanceAbortConsumer {
 readonly #stop=new AbortController();
 readonly #scopes:Scope[];
 readonly #limits:{pollIntervalMs:number;maxConcurrentProjects:number;maxScopesPerPass:number;pageSize:number};
 #nextScope=0;
 #loop:Promise<void>|undefined;
 #pass:Promise<void>|undefined;
 #drain:Promise<void>|undefined;
 lastError:string|null=null;

 private constructor(readonly storage:Pick<SqliteStorage,'request'>,options:AcceptanceAbortConsumerOptions){
  const limit=(v:number|undefined,fallback:number,min:number,max:number)=>{const n=v??fallback;if(!Number.isSafeInteger(n)||n<min||n>max)invalid();return n;};
  if(!Array.isArray(options.bindings)||options.bindings.length<1||options.bindings.length>32)invalid();
  this.#limits={pollIntervalMs:limit(options.pollIntervalMs,5000,1000,30000),maxConcurrentProjects:limit(options.maxConcurrentProjects,2,1,2),maxScopesPerPass:limit(options.maxScopesPerPass,32,1,32),pageSize:limit(options.pageSize,1,1,20)};
  const projects=new Set<string>();
  this.#scopes=options.bindings.map(input=>{
   const binding=Object.freeze({projectId:ids.project.parse(input.projectId),policyHash:sha256.parse(input.policyHash),principalId:opaqueKey.parse(input.principalId),backendRef:opaqueKey.parse(input.backendRef),runnerId:opaqueKey.parse(input.runnerId),backend:input.backend});
   const backend=binding.backend;
   if(projects.has(binding.projectId)||!backend?.configured||typeof backend.advance!=='function')invalid();
   projects.add(binding.projectId);
    return {binding,advance:backend.advance.bind(backend),cursor:0};
  });
 }

 static async create(storage:Pick<SqliteStorage,'request'>,options:AcceptanceAbortConsumerOptions):Promise<AcceptanceAbortConsumer>{
  const consumer=new AcceptanceAbortConsumer(storage,options);
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
   if(!b.backend.configured)throw new StorageError('ACCEPTANCE_ABORT_BACKEND_NOT_CONFIGURED',503,'Original abort backend unavailable');
   const page=await this.storage.request('listAcceptanceAbortWork',{principalId:b.principalId,projectId:b.projectId,policyHash:b.policyHash,afterSequence:scope.cursor,limit:this.#limits.pageSize});scope.cursor=page.nextSequence??0;
    for(const {preparation:p,record} of page.items){
     if(this.#stop.signal.aborted)return;
     const q=p.request;if(p.resolution!=='ABORTING'||p.projectId!==b.projectId||p.policyHash!==b.policyHash||q.policyHash!==b.policyHash||q.projectId!==b.projectId||q.backendPrincipalId!==b.principalId||q.backendRef!==b.backendRef||q.runnerId!==b.runnerId||record.decision.preparation.operationId!==p.operationId||record.decision.preparationRequestHash!==p.requestHash)throw new StorageError('ACCEPTANCE_ABORT_RECOVERY_SCOPE_CHANGED',409,'Original abort work changed');
     try{const result=await scope.advance({operationId:p.operationId,requestHash:p.requestHash},this.#stop.signal);if(result.state==='UNKNOWN')this.recordCode(result.errorCode);}catch(error){this.recordError(error);}
    }
  }catch(error){this.recordError(error);}
 }
 private recordCode(code:string):void{if(!this.#stop.signal.aborted)this.lastError=/^[A-Z][A-Z0-9_]{0,95}$/.test(code)?code:'ACCEPTANCE_ABORT_RECOVERY_UNAVAILABLE';}
  private recordError(error:unknown):void{this.recordCode(error instanceof StorageError?error.code:'');}
 start():void{
  if(this.#loop||this.#stop.signal.aborted)throw new Error('Acceptance abort consumer can only start once');
  this.#loop=(async()=>{while(!this.#stop.signal.aborted){await this.tick();try{await delay(this.#limits.pollIntervalMs,undefined,{signal:this.#stop.signal});}catch{break;}}})();
 }
 stopAdmission():void{this.#stop.abort();}
 stop():Promise<void>{this.stopAdmission();return this.#drain??=Promise.all([this.#loop,this.#pass]).then(()=>{});}
}
