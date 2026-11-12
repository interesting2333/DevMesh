import { Worker } from 'node:worker_threads';
import { acquireWriterLock } from '@devmesh/storage-sqlite';
import { RunnerError } from './protocol.js';
import type { RunnerStoreMethod,StoreInput,StoreResults } from './store-protocol.js';
export interface RunnerStoreOptions {databasePath:string;runnerId:string;initialize?:boolean;recoveryToken?:string;queueCapacity?:number}
export class RunnerStore {
 readonly #worker:Worker;readonly #pending=new Map<number,{resolve(v:unknown):void;reject(e:Error):void}>();readonly #exited:Promise<void>;
 readonly ready:Promise<void>;#id=0;#closed=false;#closeError:unknown;
 constructor(readonly options:RunnerStoreOptions){
  const capacity=options.queueCapacity??128;if(!Number.isSafeInteger(capacity)||capacity<1||capacity>1000)throw new RunnerError('RUNNER_QUEUE_INVALID',422);
  const lock=acquireWriterLock(options.databasePath,options.recoveryToken);
  try{this.#worker=new Worker(new URL('./worker.mjs',import.meta.url),{workerData:options,execArgv:[]});}catch(error){lock.release();throw error;}
  let ready!:()=>void,failed!:(e:Error)=>void;this.ready=new Promise((resolve,reject)=>{ready=resolve;failed=reject;});
  this.#exited=new Promise(resolve=>this.#worker.once('exit',()=>{this.#closed=true;const error=new RunnerError('RUNNER_STORE_OUTCOME_UNKNOWN',503,'unknown');failed(error);for(const p of this.#pending.values())p.reject(error);this.#pending.clear();try{lock.release();}catch(error){this.#closeError=error;}finally{resolve();}}));
  this.#worker.on('error',failed);this.#worker.on('message',(m:{id:number;value?:unknown;error?:{code:string;status:number}})=>{
   if(m.id===0){if(m.error)failed(new RunnerError(m.error.code,m.error.status));else ready();return;}
   const p=this.#pending.get(m.id);if(!p)return;this.#pending.delete(m.id);if(m.error)p.reject(new RunnerError(m.error.code,m.error.status));else p.resolve(m.value);
  });
 }
 request<M extends RunnerStoreMethod>(method:M,input:StoreInput<M>):Promise<StoreResults[M]>{
  if(this.#closed)return Promise.reject(new RunnerError('RUNNER_STORE_CLOSED',503,'not-sent'));
  if(this.#pending.size>=(this.options.queueCapacity??128))return Promise.reject(new RunnerError('RUNNER_STORE_BUSY',503,'not-sent'));
  if(Buffer.byteLength(JSON.stringify(input),'utf8')>256*1024)return Promise.reject(new RunnerError('RUNNER_REQUEST_TOO_LARGE',413,'not-sent'));
  const id=++this.#id;return new Promise((resolve,reject)=>{this.#pending.set(id,{resolve:resolve as (v:unknown)=>void,reject});try{this.#worker.postMessage({id,method,input});}catch(error){this.#pending.delete(id);reject(error);}});
 }
 async close(){if(!this.#closed){this.#closed=true;this.#worker.postMessage({id:-1,method:'close'});}await this.#exited;if(this.#closeError)throw this.#closeError;}
 async terminate(){this.#closed=true;await this.#worker.terminate();await this.#exited;}
}
export async function openRunnerStore(options:RunnerStoreOptions){const store=new RunnerStore(options);try{await store.ready;return store;}catch(error){await store.terminate();throw error;}}
