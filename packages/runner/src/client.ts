import { RunnerError,startJob,renewJob,jobSchema } from './protocol.js';
import type { Job,StartJob,RenewJob } from './protocol.js';
import {z} from 'zod';
import {ids} from '@devmesh/contracts';
import {acquireWorkspaceFence,releaseWorkspaceFence,workspaceFenceSchema} from './workspace-fence.js';
import type {AcquireWorkspaceFence,WorkspaceFence} from './workspace-fence.js';
export class RunnerClient {
 readonly base:URL;
 constructor(endpoint:string,readonly credentialRef:string,readonly credentials:(ref:string)=>Promise<string|undefined>,readonly timeoutMs=10000){
  const u=new URL(endpoint);if(u.username||u.password||u.search||u.hash||!['http:','https:'].includes(u.protocol)||u.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw new RunnerError('RUNNER_ENDPOINT_INVALID',422,'not-sent');
  if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>30000)throw new RunnerError('RUNNER_TIMEOUT_INVALID',422,'not-sent');this.base=new URL(u.href.replace(/\/$/,'')+'/runner/v1/');
 }
 private async request(method:string,path:string,body?:unknown):Promise<unknown>{
  let key:string|undefined;try{key=await this.credentials(this.credentialRef);}catch{throw new RunnerError('RUNNER_AUTH_UNAVAILABLE',503,'not-sent');}
  if(!key||key.length<16)throw new RunnerError('RUNNER_NOT_CONFIGURED',503,'not-sent');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),this.timeoutMs);timer.unref();
  try{
   const r=await fetch(new URL(path,this.base),{method,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:controller.signal});
   if(!r.ok){await r.body?.cancel();throw new RunnerError(r.status===404?'JOB_NOT_FOUND':r.status===401||r.status===403?'RUNNER_FORBIDDEN':r.status===409?'RUNNER_CONFLICT':'RUNNER_UNAVAILABLE',r.status,r.status>=500?'unknown':'known');}
   if(!r.body)throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');const chunks:Uint8Array[]=[];let size=0;const reader=r.body.getReader();
   try{for(;;){const result=await reader.read();if(result.done)break;size+=result.value.length;if(size>256*1024)throw new RunnerError('RUNNER_RESPONSE_TOO_LARGE',502,'unknown');chunks.push(result.value);}}finally{await reader.cancel();}
   try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');}
  }catch(error){if(error instanceof RunnerError)throw error;throw new RunnerError('RUNNER_TRANSPORT_UNKNOWN',503,'unknown');}finally{clearTimeout(timer);}
 }
 async start(input:StartJob):Promise<Job>{return this.decode(await this.request('POST','jobs',startJob.parse(input)));}
 async get(jobId:string):Promise<Job>{return this.decode(await this.request('GET','jobs/'+encodeURIComponent(jobId)));}
 async byOperation(operationId:string):Promise<Job>{return this.decode(await this.request('GET','jobs/by-operation/'+encodeURIComponent(operationId)));}
 async stop(jobId:string):Promise<Job>{return this.decode(await this.request('POST','jobs/'+encodeURIComponent(jobId)+':stop',{}));}
 async renew(jobId:string,input:RenewJob):Promise<Job>{return this.decode(await this.request('POST','jobs/'+encodeURIComponent(jobId)+':renew',renewJob.parse(input)));}
  private decodeFence(value:unknown):WorkspaceFence{const result=workspaceFenceSchema.safeParse(value);if(!result.success)throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');return result.data;}
  async acquireWorkspaceFence(input:AcquireWorkspaceFence){return this.decodeFence(await this.request('POST','workspace-fences',acquireWorkspaceFence.parse(input)));}
  async getWorkspaceFence(fenceId:string){return this.decodeFence(await this.request('GET','workspace-fences/'+encodeURIComponent(fenceId)));}
  async workspaceFenceByOperation(operationId:string){return this.decodeFence(await this.request('GET','workspace-fences/by-operation/'+encodeURIComponent(operationId)));}
  async activeWorkspaceFence(workspaceRef:string){return this.decodeFence(await this.request('GET','workspace-fences/active/'+encodeURIComponent(workspaceRef)));}
  async releaseWorkspaceFence(fenceId:string,input:z.input<typeof releaseWorkspaceFence>){return this.decodeFence(await this.request('POST','workspace-fences/'+encodeURIComponent(fenceId)+':release',releaseWorkspaceFence.parse(input)));}
 async logs(jobId:string,offset=0,limit=16384){
  ids.job.parse(jobId);if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>65536)throw new RunnerError('RUNNER_LOG_CURSOR_INVALID',422,'not-sent');
  const schema=z.strictObject({jobId:ids.job,offset:z.number().int().nonnegative(),nextOffset:z.number().int().nonnegative(),complete:z.boolean(),data:z.string().max(87384)});
  const parsed=schema.safeParse(await this.request('GET','jobs/'+encodeURIComponent(jobId)+'/logs?offset='+offset+'&limit='+limit));
  if(!parsed.success)throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');
  const value=parsed.data,bytes=Buffer.from(value.data,'base64');
  if(value.jobId!==jobId||value.offset!==offset||value.nextOffset!==offset+bytes.byteLength||bytes.byteLength>limit||bytes.toString('base64')!==value.data)throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');
  return value;
 }
 private decode(value:unknown):Job{
  const result=jobSchema.safeParse(value);
  if(!result.success)throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');return result.data;
 }
}
