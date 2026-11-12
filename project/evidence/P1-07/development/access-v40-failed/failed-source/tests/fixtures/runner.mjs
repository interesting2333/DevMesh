import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {assertPermit} from '../../packages/contracts/dist/index.js';
import {openRunnerStorage,RunnerPolicy,RunnerManager,RunnerMaterials} from '../../packages/runner/dist/index.mjs';
export const image='registry.example/devmesh@sha256:'+'a'.repeat(64);
export function request(index=1,options={}){const now=Date.now();return {schemaVersion:'devmesh.runner-job.v1',operationId:'op_runner'+index,permit:{schemaVersion:'devmesh.permit.v1',ownerKind:'workflowAttempt',runId:'run_runner'+(options.run??1),runEpoch:0,workId:'work_runner'+index,workEpoch:0,attemptId:'attempt_runner'+index,activationId:'activation_runner'+index,grantId:'grant_runner'+index,notBefore:new Date(now-10).toISOString(),expiresAt:new Date(now+(options.ttl??14000)).toISOString(),resources:[{kind:'workspace',resourceId:'workspace'+index,access:'write'}]},imageDigest:image,workspaceRef:'workspace'+index,commandSpec:{kind:'build'},resourceLimits:{cpu:1,memoryMiB:128,pids:32,temporaryMiB:32,timeoutMs:options.timeoutMs??10000},networkPolicyRef:'none',outputSpec:[]};}
export class ControlledBackend {
 configured=true;facts=new Map();starts=[];stops=[];loseStart=false;unknownStop=false;
 async probe(){}
 async start(job,_path,_argv,authorize){if(!await authorize())throw Error('denied');this.starts.push(job.jobId);const fact={containerId:'container-'+job.jobId,state:'running',pid:123,exitCode:null,startedAt:new Date().toISOString(),finishedAt:null,labels:{}};this.facts.set(job.jobId,fact);if(this.loseStart)throw Error('reply-lost');return fact;}
 async inspect(job){return this.facts.get(job.jobId)??null;}
 async stop(job){this.stops.push(job.jobId);if(this.unknownStop)return null;const old=this.facts.get(job.jobId);if(!old)return null;const fact={...old,state:'exited',pid:0,exitCode:143,finishedAt:new Date().toISOString()};this.facts.set(job.jobId,fact);return fact;}
 async logs(){return Buffer.from('controlled backend log\n');}
}
export async function fixture(t,options={}){
 const root=await mkdtemp(join(tmpdir(),'devmesh-runner-'));const layout=await openRunnerStorage({dataRoot:join(root,'runner'),controlDataRoot:join(root,'control'),backupRoot:join(root,'backup'),runnerId:'runner.test',initialize:true});
 let manager;const cleanup=[]; t.after(async()=>{try{for(const action of cleanup.toReversed())await action();await manager?.close();}finally{await layout.close();await rm(root,{recursive:true,force:true});}});
 const workspaces={};for(let i=1;i<=6;i++){workspaces['workspace'+i]={attemptId:'attempt_runner'+i,ownerKind:'workflowAttempt',resourceId:'workspace'+i,relativePath:'workspaces/attempt_runner'+i};await mkdir(join(layout.dataRoot,workspaces['workspace'+i].relativePath));}
 const policy=new RunnerPolicy({runnerId:'runner.test',dataRoot:layout.dataRoot,imageDigests:[image],commands:{build:['node','scripts/build.mjs']},maximumCpu:4,maximumMemoryMiB:1024,maximumTemporaryMiB:64,workspaces});
 const backend=options.backend??new ControlledBackend(),revoked=new Set(),current=new Map();const authority={async verify(controller,req,permit){if(controller!=='controller.local'||revoked.has(permit.activationId))throw Error('denied');const grant=current.get(permit.grantId)??req.permit;assertPermit(permit,grant,{kind:'workspace',resourceId:req.workspaceRef,access:'write'},Date.now());}};
 manager=new RunnerManager(layout.store,policy,backend,authority,new RunnerMaterials(layout.dataRoot),{pollIntervalMs:10000,...options.manager});
 return {root,layout,policy,backend,authority,current,revoked,manager,cleanup};
}
export async function until(check,timeout=5000){const end=Date.now()+timeout;while(Date.now()<end){const result=await check();if(result)return result;await delay(10);}throw Error('condition not reached');}
