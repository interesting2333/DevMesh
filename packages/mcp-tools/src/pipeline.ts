import {setTimeout as delay} from 'node:timers/promises';
import {z} from 'zod';
import {executionPermit,ids,opaqueKey,pipelineDefinition} from '@devmesh/contracts';
import type {PipelineDefinition} from '@devmesh/contracts';
import type {PipelineDispatch,SqliteStorage} from '@devmesh/storage-sqlite';
import {RunnerError,startJob} from '@devmesh/runner';
import type {Job,RunnerClient} from '@devmesh/runner';
import {ToolError} from './protocol.js';
import type {ToolDefinition} from './protocol.js';

export const pipelineStartArgs=z.strictObject({definitionId:opaqueKey,workspaceRef:opaqueKey});
export const pipelineGetArgs=z.strictObject({pipelineId:opaqueKey});
export const pipelineOperationArgs=z.strictObject({operationId:ids.operation});
export const pipelineLogsArgs=pipelineGetArgs.extend({ordinal:z.number().int().min(0).max(7),offset:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(65536).default(16384)});

export function pipelineTools(storage:SqliteStorage,runner:RunnerClient,input:readonly PipelineDefinition[]):ToolDefinition[]{
  const definitions=z.array(pipelineDefinition).max(64).parse(structuredClone(input));
  if(new Set(definitions.map(d=>d.definitionId)).size!==definitions.length)throw new ToolError('MCP_PIPELINE_CONFIGURATION_INVALID','not-sent');
  const get=(permit:Parameters<ToolDefinition['execute']>[0]['permit'],args:Record<string,unknown>)=>storage.request('getPipeline',{permit,...pipelineGetArgs.parse(args)});
  return [
    {name:'pipeline.start',description:'Create an independent pipeline with frozen approved stages; acknowledgement is not stage success',schema:pipelineStartArgs,action:'write',effectClass:'NONIDEMPOTENT_WRITE',async execute({permit,operationId,args}){
      const a=pipelineStartArgs.parse(args),definition=definitions.find(d=>d.definitionId===a.definitionId);if(!definition)throw new ToolError('MCP_PIPELINE_DEFINITION_DENIED','not-sent');
      return storage.request('createPipeline',{permit,operationId,workspaceRef:a.workspaceRef,definition});
    }},
    {name:'pipeline.get',description:'Read the original pipeline and its independent stage records',schema:pipelineGetArgs,action:'read',effectClass:'READ',execute:({permit,args})=>get(permit,args)},
    {name:'pipeline.stop',description:'Request stop of original stages; unresolved jobs remain unresolved until exit is verified',schema:pipelineGetArgs,action:'stop',effectClass:'IDEMPOTENT_WRITE',execute:({permit,args})=>storage.request('stopPipeline',{permit,...pipelineGetArgs.parse(args)})},
    {name:'pipeline.by-operation',description:'Query a pipeline by original creation operation without starting another',schema:pipelineOperationArgs,action:'read',effectClass:'READ',execute:({permit,args})=>storage.request('getPipelineOperation',{permit,...pipelineOperationArgs.parse(args)})},
    {name:'pipeline.artifacts',description:'List exact per-stage Runner output references and hashes',schema:pipelineGetArgs,action:'read',effectClass:'READ',async execute({permit,args}){
      const p=await get(permit,args);return {pipelineId:p.pipelineId,stages:p.stages.map(s=>({ordinal:s.ordinal,stageId:s.stageId,jobId:s.jobId,outputs:s.outputRefs.map((r,index)=>({...r,index}))}))};
    }},
    {name:'pipeline.logs',description:'Read a bounded byte page from an original stage log through the Runner service',schema:pipelineLogsArgs,action:'read',effectClass:'READ',async execute({permit,args}){
      const a=pipelineLogsArgs.parse(args),p=await get(permit,{pipelineId:a.pipelineId}),stage=p.stages.find(s=>s.ordinal===a.ordinal);
      if(!stage?.jobId)throw new ToolError('MCP_PIPELINE_LOGS_UNAVAILABLE','not-sent');
      return runner.logs(stage.jobId,a.offset,a.limit);
    }},
  ];
}

/** Explicitly started coordinator; only this service writes stage/Runner facts. */
export class PipelineCoordinator {
  readonly #stop=new AbortController();#loop:Promise<void>|undefined;lastError:string|null=null;
  constructor(readonly storage:SqliteStorage,readonly runner:RunnerClient){}
  private async record(item:PipelineDispatch,job:Job){
    const {jobId,operationId,requestHash,request,state,exitCode,errorCode,stopRequested,stopEvidence,containerId,startedAt,logCursor,outputRefs}=job;
    executionPermit.parse(request.permit);
    await this.storage.request('recordPipelineStage',{pipelineId:item.pipelineId,ordinal:item.ordinal,
      job:{jobId,operationId,requestHash,request:z.record(z.string(),z.json()).parse(request),state,exitCode,errorCode,stopRequested,stopEvidence:z.record(z.string(),z.json()).nullable().parse(stopEvidence),containerId,startedAt,logCursor,outputRefs}});
  }
  async process(item:PipelineDispatch){
    if(this.#stop.signal.aborted)return;
    let job:Job;
    try{
      if(item.state==='PENDING'){
        const admitted=await this.storage.request('markPipelineStageSent',{pipelineId:item.pipelineId,ordinal:item.ordinal});
        if(!admitted.send||!admitted.request)return;
        if(this.#stop.signal.aborted)throw new ToolError('PIPELINE_COORDINATOR_STOPPED','not-sent');
        job=await this.runner.start(startJob.parse(admitted.request));
      }else{
        // SENT may have reached Runner even when no local job ID exists. Never resend it.
        job=item.jobId?await this.runner.get(item.jobId):await this.runner.byOperation(item.operationId);
      }
      // Preserve an observed original job even if current authority no longer
      // permits renewing it after restart. Query facts and continuation differ.
      await this.record(item,job);const observed=job;
      if(item.stopRequested&&job.state!=='EXITED')job=await this.runner.stop(job.jobId);
      else if(job.state!=='EXITED'&&!job.stopRequested&&Date.now()-Date.parse(job.lastHeartbeat)>=5000){
        const permit=await this.storage.request('getPipelineStagePermit',{pipelineId:item.pipelineId,ordinal:item.ordinal});
        job=await this.runner.renew(job.jobId,{permit,sequence:job.leaseSequence+1});
      }
      if(job!==observed)await this.record(item,job);
    }catch(error){
      this.lastError=error instanceof RunnerError||error instanceof ToolError?error.code:'PIPELINE_STAGE_UNAVAILABLE';
      await this.storage.request('markPipelineStageUnknown',{pipelineId:item.pipelineId,ordinal:item.ordinal,errorCode:this.lastError});
    }
  }
  async tick(){for(const item of await this.storage.request('listPipelineStages',{})){if(this.#stop.signal.aborted)return;await this.process(item);}}
  start(){
    if(this.#loop||this.#stop.signal.aborted)throw new ToolError('PIPELINE_ALREADY_STARTED','not-sent');
    this.#loop=(async()=>{while(!this.#stop.signal.aborted){try{await this.tick();}catch{this.lastError='PIPELINE_COORDINATOR_UNAVAILABLE';}try{await delay(250,undefined,{signal:this.#stop.signal});}catch{break;}}})();
  }
  async stop(){this.#stop.abort();await this.#loop;}
}
