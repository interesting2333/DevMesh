import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {canonical} from '@devmesh/storage-sqlite';
import type {AcceptancePreparation} from '@devmesh/storage-sqlite';
import type {CliExecutor} from './docker.js';
import type {PreviewDockerOptions} from './preview-docker.js';
import {dockerObjectId} from './preview-container.js';
import {acceptanceServiceProfile,acceptanceServiceRequest} from './acceptance-service.js';
import type {AcceptanceServiceProfile,AcceptanceServiceRequest,AcceptanceServiceDriver} from './acceptance-service.js';
import {serviceDockerNetworkArguments,serviceDockerCreateArguments,verifyServiceDockerImage,verifyServiceDockerNetwork,verifyServiceDockerContainer} from './service-docker.js';
import type {ServiceContainerFact} from './service-docker.js';
import {RunnerError} from './protocol.js';

export type AcceptanceDockerOptions=PreviewDockerOptions;
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
const subject=(p:AcceptanceServiceProfile|null,r:AcceptancePreparation['request'])=>({imageDigest:r.image.imageDigest,imageIdentity:r.image,readonlyDataset:true,errorPrefix:'ACCEPTANCE_SERVICE' as const,labels:p?{'devmesh.runner':r.runnerId,'devmesh.purpose':'ACCEPTANCE','devmesh.operation':r.operationId,'devmesh.release':r.releaseId,'devmesh.dataset':r.target.datasetId,'devmesh.reservation':p.reservationId,'devmesh.request':p.requestHash,'devmesh.profile':hash(p)}:{}});
const binding=(raw:AcceptanceServiceProfile,input:AcceptanceServiceRequest)=>{const p=acceptanceServiceProfile.parse(raw),r=acceptanceServiceRequest.parse(input);if(p.requestHash!==hash(r))throw new RunnerError('ACCEPTANCE_SERVICE_IDENTITY_CHANGED',409);return {p,r:r.preparation};};
export function acceptanceDockerNetworkArguments(raw:AcceptanceServiceProfile,input:AcceptanceServiceRequest){const {p,r}=binding(raw,input);return serviceDockerNetworkArguments(p,subject(p,r));}
export function acceptanceDockerCreateArguments(raw:AcceptanceServiceProfile,input:AcceptanceServiceRequest,networkId:string){const {p,r}=binding(raw,input);return serviceDockerCreateArguments(p,subject(p,r),networkId);}
export function verifyAcceptanceDockerImage(value:unknown,r:AcceptancePreparation['request'],repository:string){return verifyServiceDockerImage(value,subject(null,r),repository);}
export function verifyAcceptanceDockerNetwork(value:unknown,raw:AcceptanceServiceProfile,input:AcceptanceServiceRequest){const {p,r}=binding(raw,input);return verifyServiceDockerNetwork(value,p,subject(p,r));}
export function verifyAcceptanceDockerContainer(value:unknown,raw:AcceptanceServiceProfile,input:AcceptanceServiceRequest,networkId:string,containerId:string|null){const {p,r}=binding(raw,input);return verifyServiceDockerContainer(value,p,subject(p,r),networkId,containerId);}

/** Explicit Linux driver. Every physical observation rechecks the full original
 * profile; the entire acceptance dataset is mounted read-only. */
export class DockerAcceptanceServiceDriver implements AcceptanceServiceDriver {
 readonly configured:boolean;readonly #execute:CliExecutor;readonly #options:AcceptanceDockerOptions;
 constructor(options:AcceptanceDockerOptions,executor?:CliExecutor){
  if(!isAbsolute(options.dockerPath)||!options.socketPath.startsWith('/')||/[\0\r\n]/.test(options.socketPath))throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_CONFIG_INVALID',422);
  this.#options={...options};this.configured=options.enabled===true&&process.platform==='linux'&&!!options.quota&&!!options.networkIsolation;
  this.#execute=executor??((args,timeoutMs,maximumBytes)=>new Promise((resolve,reject)=>{const child=spawn(options.dockerPath,['--host','unix://'+options.socketPath,...args],{shell:false,windowsHide:true,stdio:['ignore','pipe','ignore'],env:{PATH:'/usr/local/bin:/usr/bin:/bin',LANG:'C.UTF-8'}});let count=0;const chunks:Buffer[]=[];const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new RunnerError('ACCEPTANCE_SERVICE_DOCKER_UNKNOWN',503,'unknown'));},timeoutMs);timer.unref();child.stdout.on('data',(b:Buffer)=>{count+=b.length;if(count>maximumBytes){child.kill('SIGKILL');reject(new RunnerError('ACCEPTANCE_SERVICE_DOCKER_OUTPUT_LIMIT',503,'unknown'));}else chunks.push(b);});child.once('error',()=>{clearTimeout(timer);reject(new RunnerError('ACCEPTANCE_SERVICE_DOCKER_UNAVAILABLE',503,'unknown'));});child.once('close',code=>{clearTimeout(timer);resolve({code:code??-1,stdout:Buffer.concat(chunks).toString('utf8')});});}));
 }
 #enabled(){if(!this.configured)throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_NOT_CONFIGURED',503,'not-sent');}
 async #call(args:readonly string[]){this.#enabled();const r=await this.#execute(args,15000,256*1024);if(r.code!==0)throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_UNKNOWN',503,'unknown');return r.stdout;}
 async probe(r:AcceptancePreparation['request'],repository:string){this.#enabled();const info=z.object({OSType:z.literal('linux'),CgroupVersion:z.literal('2'),MemoryLimit:z.literal(true),SwapLimit:z.literal(true),CpuCfsQuota:z.literal(true),PidsLimit:z.literal(true),Runtimes:z.record(z.string(),z.unknown())}).parse(JSON.parse(await this.#call(['info','--format','{{json .}}'])));if(!Object.hasOwn(info.Runtimes,'runsc'))throw new RunnerError('ACCEPTANCE_SERVICE_RUNSC_UNAVAILABLE',503,'not-sent');verifyAcceptanceDockerImage(JSON.parse(await this.#call(['image','inspect',repository+'@'+r.image.imageDigest])),r,repository);}
 async prepare(p:AcceptanceServiceProfile){this.#enabled();acceptanceServiceProfile.parse(p);await this.#options.quota!.prepare(p.datasetDirectory,p.datasetBytes);if(!await this.#options.quota!.verify(p.datasetDirectory,p.datasetBytes))throw new RunnerError('ACCEPTANCE_SERVICE_QUOTA_UNVERIFIED',503);}
 async network(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest){this.#enabled();binding(p,r);const out=await this.#execute(['network','inspect',p.networkName],15000,256*1024);if(out.code!==0)return null;const id=verifyAcceptanceDockerNetwork(JSON.parse(out.stdout),p,r);return await this.#options.networkIsolation!.verify(id)?id:null;}
 async createNetwork(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,authorize:()=>Promise<boolean>){this.#enabled();binding(p,r);if(!await authorize())throw new RunnerError('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED',403,'not-sent');const id=dockerObjectId.parse((await this.#call(acceptanceDockerNetworkArguments(p,r))).trim());await this.#options.networkIsolation!.enforce(id);if(await this.network(p,r)!==id)throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_NETWORK_CHANGED',409);return id;}
 async inspect(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,networkId:string,containerId:string|null):Promise<ServiceContainerFact|null>{this.#enabled();if(await this.network(p,r)!==networkId||!await this.#options.quota!.verify(p.datasetDirectory,p.datasetBytes))throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_PROFILE_UNVERIFIED',409);const out=await this.#execute(['inspect','--type','container',p.containerName],15000,256*1024);return out.code===0?verifyAcceptanceDockerContainer(JSON.parse(out.stdout),p,r,networkId,containerId):null;}
 async create(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,networkId:string,authorize:()=>Promise<boolean>){this.#enabled();if(!await this.#options.quota!.verify(p.datasetDirectory,p.datasetBytes)||await this.network(p,r)!==networkId)throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_CREATE_UNVERIFIED',409);if(!await authorize())throw new RunnerError('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED',403,'not-sent');const id=dockerObjectId.parse((await this.#call(acceptanceDockerCreateArguments(p,r,networkId))).trim());return this.inspect(p,r,networkId,id);}
 async start(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>){const before=await this.inspect(p,r,networkId,containerId);if(before?.state!=='created')throw new RunnerError('ACCEPTANCE_SERVICE_DOCKER_START_UNVERIFIED',409);if(!await authorize())throw new RunnerError('ACCEPTANCE_SERVICE_AUTHORITY_REVOKED',403,'not-sent');await this.#call(['start',containerId]);return this.inspect(p,r,networkId,containerId);}
}
