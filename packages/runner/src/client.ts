import { RunnerError,startJob,renewJob,jobSchema } from './protocol.js';
import type { Job,StartJob,RenewJob } from './protocol.js';
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
 private decode(value:unknown):Job{
  const result=jobSchema.safeParse(value);
  if(!result.success)throw new RunnerError('RUNNER_RESPONSE_INVALID',502,'unknown');return result.data;
 }
}
