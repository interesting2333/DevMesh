// Only the Runner SQLite, dataset files and HTTP probe are real here. This
// driver supplies explicit container/network facts and executes no Docker.
import {createHash,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {canonical,previewStartRequest,previewStopRequest} from '../../packages/storage-sqlite/dist/index.mjs';
import {RunnerPreviewBackend} from '../../packages/runner/dist/index.mjs';
import {datasetFixture,datasetEffect} from './datasets.mjs';
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex');
export const imageIdentity={schemaVersion:'devmesh.preview-image-identity.v1',imageDigest:'sha256:'+'c'.repeat(64),configDigest:'sha256:'+'e'.repeat(64),targetCommit:'a'.repeat(40),buildArtifactHash:'f'.repeat(64),os:'linux',architecture:'amd64',layers:[{digest:'sha256:'+'1'.repeat(64),diffId:'sha256:'+'2'.repeat(64),byteSize:1024,expandedByteSize:1024}]};
export class ControlledContainerDriver {
 configured=true;networks=new Map();containers=new Map();calls=[];failAfter=null;unknownStop=false;prepareFails=false;beforeStart;beforeStop;
 constructor(port){this.port=port;}
 async probe(){}
 async prepare(){if(this.prepareFails)throw Error('explicit quota fixture failure');}
 #lost(kind){if(this.failAfter===kind){this.failAfter=null;throw Error('explicit '+kind+' action ACK loss');}}
 async network(p){this.calls.push('query-network');return this.networks.get(p.networkName)??null;}
 async createNetwork(p,_r,authorize){if(!await authorize())throw Error('explicit authority denied');this.calls.push('NETWORK_CREATE');const id=hash(p.reservationId+':network');this.networks.set(p.networkName,id);this.#lost('NETWORK_CREATE');return id;}
 async inspect(p,_r,networkId,containerId){this.calls.push('query-container');const f=this.containers.get(p.containerName);if(f&&(f.networkId!==networkId||containerId!==null&&f.containerId!==containerId))throw Error('explicit fixture wrong original container');return f?structuredClone(f):null;}
 async create(p,_r,networkId,authorize){if(!await authorize())throw Error('explicit authority denied');this.calls.push('CREATE');const f={containerId:hash(p.reservationId+':container'),networkId,state:'created',pid:0,exitCode:null,endpoint:null};this.containers.set(p.containerName,f);this.#lost('CREATE');return structuredClone(f);}
 async start(p,_r,_networkId,_containerId,authorize){await this.beforeStart?.();if(!await authorize())throw Error('explicit authority denied');this.calls.push('START');const f=this.containers.get(p.containerName);Object.assign(f,{state:'running',pid:123,endpoint:{host:'127.0.0.1',port:this.port}});this.#lost('START');return structuredClone(f);}
 async stop(p,_r,_networkId,_containerId,authorize){const f=this.containers.get(p.containerName);if(['created','exited'].includes(f.state))return structuredClone(f);await this.beforeStop?.();if(!await authorize())throw Error('explicit authority denied');this.calls.push('STOP');if(!this.unknownStop&&f.state==='running')Object.assign(f,{state:'exited',pid:0,exitCode:143,endpoint:null});this.#lost('STOP');return structuredClone(f);}
}
export async function containerFixture(t){
 const data=await datasetFixture(t),original=datasetEffect(),ready=await data.prepare(original),dataset={...original,state:'SUCCEEDED',receipt:ready.receipt};
 const server=createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({status:'ready'}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));data.cleanup.push(()=>new Promise(resolve=>server.close(resolve)));
 const driver=new ControlledContainerDriver(server.address().port),options={enabled:true,runnerId:data.options.runnerId,controllerId:'controller.preview.fixture',backendRef:data.backendOptions.backendRef,repository:'registry.example/devmesh-preview',capacity:{maximumJobs:4,cpu:4,memoryMiB:1024},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32},datasetBytes:64*1024*1024},d=dataset.request,operationId='op_'+randomUUID().replaceAll('-',''),previewId='preview_'+randomUUID().replaceAll('-','');
 const request=previewStartRequest.parse({schemaVersion:'devmesh.preview-start.v1',operationId,projectId:d.projectId,runId:d.runId,candidateId:d.candidateId,policyHash:d.policyHash,backendRef:d.backendRef,runnerId:d.runnerId,previewId,datasetId:d.datasetId,imageDigest:imageIdentity.imageDigest,manifestHash:d.manifestHash,storageKey:d.storageKey,datasetOperationId:d.operationId,templateVersion:d.templateVersion,schemaRevision:d.schemaRevision,imageIdentity,expiresAt:new Date(Date.now()+3600000).toISOString()});
 const effect={operationId,projectId:d.projectId,runId:d.runId,candidateId:d.candidateId,datasetId:d.datasetId,previewId,policyHash:d.policyHash,kind:'PREVIEW_START',remoteKey:previewId,requestHash:hash(request),request,state:'SENT',revision:2,receipt:null,errorCode:null,createdAt:new Date().toISOString()},store=data.layout.store,backend=new RunnerPreviewBackend(store,data.paths,data.backend,driver,options);
 const reservation=()=>store.request('previewReservationByOperation',{controllerId:options.controllerId,operationId});
 return {data,dataset,driver,options,store,effect,backend,reservation,mutations:()=>driver.calls.filter(v=>!v.startsWith('query-')),async journal(){const r=await reservation();return store.request('previewContainerGet',{controllerId:r.controllerId,reservationId:r.reservationId,requestHash:r.requestHash});},stop(instanceId){const r=previewStopRequest.parse({schemaVersion:'devmesh.preview-stop.v1',operationId:'op_'+randomUUID().replaceAll('-',''),projectId:request.projectId,runId:request.runId,candidateId:request.candidateId,policyHash:request.policyHash,backendRef:request.backendRef,runnerId:request.runnerId,previewId:request.previewId,datasetId:request.datasetId,imageDigest:request.imageDigest,startOperationId:operationId,startRequestHash:effect.requestHash,instanceId,reason:'USER'});return {...effect,operationId:r.operationId,kind:'PREVIEW_STOP',requestHash:hash(r),request:r};}};
}
