import { z } from 'zod';
import { executionPermit,ids,opaqueKey,relativeFile,sha256,timestamp } from '@devmesh/contracts';
export class RunnerError extends Error {
 constructor(readonly code:string,readonly status:number,readonly outcome:'not-sent'|'known'|'unknown'='known'){super(code);}
}
export const imageDigest=z.string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/);
export const commandSpec=z.strictObject({kind:z.enum(['install','build','unit','e2e','preview'])});
export const resourceLimits=z.strictObject({cpu:z.number().positive().max(64),memoryMiB:z.number().int().min(64).max(131072),pids:z.number().int().min(16).max(256),temporaryMiB:z.number().int().min(16).max(10240),timeoutMs:z.number().int().min(100).max(600000)});
export const startJob=z.strictObject({schemaVersion:z.literal('devmesh.runner-job.v1'),operationId:ids.operation,permit:executionPermit,imageDigest,workspaceRef:opaqueKey,commandSpec,resourceLimits,networkPolicyRef:opaqueKey,outputSpec:z.array(relativeFile).max(32)});
export const renewJob=z.strictObject({permit:executionPermit,sequence:z.number().int().positive()});
export type StartJob=z.output<typeof startJob>;
export type RenewJob=z.output<typeof renewJob>;
export type JobState='QUEUED'|'STARTING'|'RUNNING'|'STOPPING'|'EXITED'|'OUTCOME_UNKNOWN';
export interface Job {
 jobId:string;controllerId:string;operationId:string;requestHash:string;request:StartJob;
 state:JobState;containerId:string|null;createdAt:string;startedAt:string|null;endedAt:string|null;exitCode:number|null;
 stopRequested:boolean;stopEvidence:Record<string,unknown>|null;errorCode:string|null;leaseSequence:number;
 lastHeartbeat:string;logCursor:number;outputRefs:{path:string;sha256:string;byteSize:number}[];
}
export interface ContainerFact {
 containerId:string;state:'created'|'running'|'exited'|'unknown';pid:number|null;exitCode:number|null;
 startedAt:string|null;finishedAt:string|null;labels:Record<string,string>;
}
export interface ExecutionBackend {
 readonly configured:boolean;
 probe():Promise<void>;
 start(job:Job,workspacePath:string,argv:readonly string[],authorize:()=>Promise<boolean>):Promise<ContainerFact>;
 inspect(job:Job):Promise<ContainerFact|null>;
 stop(job:Job):Promise<ContainerFact|null>;
 logs(job:Job):Promise<Uint8Array>;
}
export const jobSchema=z.strictObject({jobId:ids.job,controllerId:opaqueKey,operationId:ids.operation,requestHash:sha256,request:startJob,state:z.enum(['QUEUED','STARTING','RUNNING','STOPPING','EXITED','OUTCOME_UNKNOWN']),containerId:z.string().min(1).nullable(),createdAt:timestamp,startedAt:timestamp.nullable(),endedAt:timestamp.nullable(),exitCode:z.number().int().nullable(),stopRequested:z.boolean(),stopEvidence:z.record(z.string(),z.json()).nullable(),errorCode:opaqueKey.nullable(),leaseSequence:z.number().int().nonnegative(),lastHeartbeat:timestamp,logCursor:z.number().int().nonnegative(),outputRefs:z.array(z.strictObject({path:relativeFile,sha256,byteSize:z.number().int().nonnegative()}))});
export interface RunnerAuthority {
 /** Must check current committed grant/epochs and service caller scopes. */
 verify(controllerId:string,request:StartJob,permit:StartJob['permit']):Promise<void>;
  /** Required only for managed workspace fencing; must check the current grant. */
  verifyWorkspace?(controllerId:string,permit:StartJob['permit'],workspaceRef:string):Promise<void>;
}
export const ownerKey=(p:StartJob['permit'])=>p.ownerKind==='workflowAttempt'?'run:'+p.runId:'invocation:'+p.invocationId;
export const attemptKey=(p:StartJob['permit'])=>p.ownerKind==='workflowAttempt'?p.attemptId:p.invocationAttemptId;
