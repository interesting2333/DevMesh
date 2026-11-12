import { setTimeout as delay } from 'node:timers/promises';
import type { SqliteStorage } from '@devmesh/storage-sqlite';
import type { AgentRuntime,ExecutionClaim } from './runtime.js';

/** Optional bounded consumer. Construction alone never starts model calls. */
export class RuntimeConsumer {
 readonly #abort=new AbortController();
 readonly #active=new Set<Promise<void>>();
 #loop:Promise<void>|undefined;
 #stopped=false;
 lastError:string|null=null;
 constructor(readonly storage:SqliteStorage,readonly runtime:AgentRuntime,readonly endpointIds:readonly string[],readonly workerId:string){}
 async start(){
  if(this.#loop||this.#stopped)throw new Error('Consumer can only start once');
  await this.storage.request('recoverRuntimeActivations',{});
  this.#loop=this.poll();
 }
 private async poll(){
  while(!this.#abort.signal.aborted){
   try{
    for(const endpointId of this.endpointIds){
     if(this.#abort.signal.aborted||this.#active.size>=2)break;
     const claims=await this.storage.request('claimAcceptedWork',{endpointId,workerId:this.workerId,limit:1});
     for(const c of claims){const claim={endpointId:c.endpointId,taskId:c.taskId,workerId:c.workerId,claimToken:c.claimToken};const job=this.consume(claim).catch(error=>{this.lastError=error instanceof Error&&'code' in error?String(error.code):'CONSUMER_FAILURE';}).finally(()=>this.#active.delete(job));this.#active.add(job);}
    }
   }catch(error){this.lastError=error instanceof Error&&'code' in error?String(error.code):'CONSUMER_FAILURE';}
   try{await delay(100,undefined,{signal:this.#abort.signal});}catch{break;}
  }
 }
 private async consume(claim:ExecutionClaim){
  const snapshot=await this.storage.request('getAcceptedTaskSnapshot',claim);
  const outcome=await this.runtime.execute(claim,this.#abort.signal);
  if(outcome.state==='reconcile'){await this.storage.request('reconcileRuntimeTask',{...claim,reason:outcome.code});return;}
  if(outcome.state==='completed')return; // Publication already committed the Task.
  const status={state:'TASK_STATE_FAILED',timestamp:new Date().toISOString()};
  await this.storage.request('settleAcceptedWork',{...claim,state:'failed',snapshot:{...snapshot,status,artifacts:[],metadata:{...(snapshot.metadata as object),runtimeError:outcome.code}}});
 }
 async stop(){this.#stopped=true;this.#abort.abort();await this.#loop;await Promise.allSettled(this.#active);}
}
