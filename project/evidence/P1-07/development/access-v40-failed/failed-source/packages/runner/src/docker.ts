import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { RunnerError } from './protocol.js';
import type { ContainerFact,ExecutionBackend,Job } from './protocol.js';

export interface WorkspaceQuota {
 /** Return only after the filesystem enforces the requested hard workspace quota. */
 enforce(workspacePath:string,maximumBytes:number):Promise<void>;
}
export interface DockerOptions {enabled?:boolean;runnerId:string;dockerPath:string;socketPath:string;workspaceBytes:number;quota?:WorkspaceQuota}
export type CliExecutor=(args:readonly string[],timeoutMs:number,maximumBytes:number)=>Promise<{code:number;stdout:string}>;
const inspectSchema=z.array(z.object({Id:z.string().min(1),Config:z.object({Labels:z.record(z.string(),z.string()).nullable()}),State:z.object({Status:z.string(),Running:z.boolean(),Pid:z.number().int().nonnegative(),ExitCode:z.number().int(),StartedAt:z.string(),FinishedAt:z.string()})})).length(1);
export class DockerBackend implements ExecutionBackend {
 readonly configured:boolean;readonly #options:DockerOptions;readonly #execute:CliExecutor;
 constructor(options:DockerOptions,executor?:CliExecutor){
  this.#options={...options};
  if(!isAbsolute(options.dockerPath)||!options.socketPath.startsWith('/')||!Number.isSafeInteger(options.workspaceBytes)||options.workspaceBytes<1048576||options.workspaceBytes>10*1024**3)throw new RunnerError('RUNNER_DOCKER_CONFIG_INVALID',422);
  this.configured=options.enabled===true&&!!options.quota&&process.platform==='linux';
  this.#execute=executor??((args,timeoutMs,maximumBytes)=>new Promise((resolve,reject)=>{
   const child=spawn(options.dockerPath,['--host','unix://'+options.socketPath,...args],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'}});
   let bytes=0;const chunks:Buffer[]=[];const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new RunnerError('RUNNER_DOCKER_UNKNOWN',503,'unknown'));},timeoutMs);timer.unref();
   const collect=(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>maximumBytes){child.kill('SIGKILL');reject(new RunnerError('RUNNER_DOCKER_OUTPUT_LIMIT',503,'unknown'));}else chunks.push(chunk);};child.stdout.on('data',collect);if(args[0]==='logs')child.stderr.on('data',collect);else child.stderr.resume();
   child.once('error',()=>{clearTimeout(timer);reject(new RunnerError('RUNNER_DOCKER_UNAVAILABLE',503,'unknown'));});child.once('close',code=>{clearTimeout(timer);resolve({code:code??-1,stdout:Buffer.concat(chunks).toString('utf8')});});
  }));
 }
 private enabled(){if(!this.configured)throw new RunnerError('RUNNER_NOT_CONFIGURED',503,'not-sent');}
 private async call(args:readonly string[],timeout=15000,maximumBytes=1024*1024){const r=await this.#execute(args,timeout,maximumBytes);if(r.code!==0)throw new RunnerError('RUNNER_DOCKER_UNKNOWN',503,'unknown');return r.stdout;}
 async probe(){this.enabled();const result=z.object({OSType:z.literal('linux'),Runtimes:z.record(z.string(),z.unknown())}).parse(JSON.parse(await this.call(['info','--format','{{json .}}'])));if(!Object.hasOwn(result.Runtimes,'runsc'))throw new RunnerError('RUNNER_RUNSC_UNAVAILABLE',503,'not-sent');}
 createArguments(job:Job,workspacePath:string,argv:readonly string[]):string[]{
  if(!isAbsolute(workspacePath)||['\0','\r','\n',','].some(c=>workspacePath.includes(c))||!argv.length||argv.some(a=>a.includes('\0')))throw new RunnerError('RUNNER_COMMAND_DENIED',403);
  const l=job.request.resourceLimits;
  return ['create','--name','devmesh-'+job.jobId,'--label','devmesh.runner='+this.#options.runnerId,'--label','devmesh.job='+job.jobId,'--label','devmesh.request='+job.requestHash,'--runtime=runsc','--network=none','--user=10001:10001','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges:true','--pids-limit='+l.pids,'--cpus='+l.cpu,'--memory='+l.memoryMiB+'m','--memory-swap='+l.memoryMiB+'m','--ulimit','nofile=1024:1024','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size='+l.temporaryMiB+'m,mode=1777','--mount','type=bind,src='+workspacePath+',dst=/workspace','--workdir=/workspace','--log-driver=local','--log-opt=max-size=10m','--log-opt=max-file=2','--env','HOME=/tmp','--env','CI=true','--entrypoint='+argv[0],job.request.imageDigest,...argv.slice(1)];
 }
 private verify(job:Job,fact:ContainerFact){if(fact.labels['devmesh.runner']!==this.#options.runnerId||fact.labels['devmesh.job']!==job.jobId||fact.labels['devmesh.request']!==job.requestHash||job.containerId!==null&&job.containerId!==fact.containerId)throw new RunnerError('RUNNER_CONTAINER_IDENTITY_MISMATCH',409);return fact;}
 async start(job:Job,workspacePath:string,argv:readonly string[],authorize:()=>Promise<boolean>){
  this.enabled();await this.#options.quota!.enforce(workspacePath,this.#options.workspaceBytes);
  const digests=z.array(z.string()).parse(JSON.parse(await this.call(['image','inspect','--format','{{json .RepoDigests}}',job.request.imageDigest])));if(!digests.includes(job.request.imageDigest))throw new RunnerError('RUNNER_IMAGE_UNAVAILABLE',503,'not-sent');
  if(!await authorize())throw new RunnerError('RUNNER_LEASE_REVOKED',403,'not-sent');
  // Exactly one create/start per durable claim. A lost reply is reconciled by name/labels.
  await this.call(this.createArguments(job,workspacePath,argv));
  if(!await authorize())throw new RunnerError('RUNNER_LEASE_REVOKED',403,'unknown');
  await this.call(['start','devmesh-'+job.jobId]);
  const fact=await this.inspect(job);if(!fact)throw new RunnerError('RUNNER_DOCKER_UNKNOWN',503,'unknown');return fact;
 }
 async inspect(job:Job):Promise<ContainerFact|null>{
  this.enabled();const r=await this.#execute(['inspect','--type','container','devmesh-'+job.jobId],15000,128*1024);
  // Nonzero inspect may mean daemon failure or missing container: neither proves exit.
  if(r.code!==0)return null;const data=inspectSchema.parse(JSON.parse(r.stdout))[0]!;
  const s=data.State,state:ContainerFact['state']=s.Running?'running':s.Status==='exited'&&s.Pid===0?'exited':s.Status==='created'&&s.Pid===0?'created':'unknown';
  return this.verify(job,{containerId:data.Id,state,pid:s.Pid,exitCode:state==='exited'?s.ExitCode:null,startedAt:s.StartedAt,finishedAt:s.FinishedAt,labels:data.Config.Labels??{}});
 }
 async stop(job:Job){this.enabled();const before=await this.inspect(job);if(before?.state==='exited')return before;if(before?.state==='running')await this.#execute(['stop','--signal=SIGTERM','--timeout=10','devmesh-'+job.jobId],15000,4096);return this.inspect(job);}
 async logs(job:Job){this.enabled();const fact=await this.inspect(job);if(!fact)throw new RunnerError('RUNNER_DOCKER_UNKNOWN',503,'unknown');const value=await this.call(['logs','--timestamps','--tail','10000','devmesh-'+job.jobId],15000,1024*1024);return new TextEncoder().encode(value);}
}
