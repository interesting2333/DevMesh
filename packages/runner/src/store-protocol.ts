import { z } from 'zod';
import { opaqueKey } from '@devmesh/contracts';
import { startJob,renewJob } from './protocol.js';
import type { Job } from './protocol.js';
const owner={controllerId:opaqueKey};
export const storeRequests={
 register:z.strictObject({...owner,request:startJob,execution:z.strictObject({workspacePath:z.string().min(1),argv:z.array(z.string()).min(1)})}),
 get:z.strictObject({...owner,jobId:opaqueKey}),
 byOperation:z.strictObject({...owner,operationId:opaqueKey}),
 pending:z.strictObject({limit:z.number().int().min(1).max(100).default(20)}),
 active:z.strictObject({}),
 claim:z.strictObject({jobId:opaqueKey,maximumJobs:z.number().int().min(1).max(4),cpu:z.number().positive(),memoryMiB:z.number().int().positive()}),
 stop:z.strictObject({...owner,jobId:opaqueKey}),
 renew:z.strictObject({...owner,jobId:opaqueKey,renewal:renewJob}),
 record:z.strictObject({jobId:opaqueKey,state:z.enum(['RUNNING','STOPPING','EXITED','OUTCOME_UNKNOWN']),containerId:z.string().nullable(),exitCode:z.number().int().nullable(),evidence:z.record(z.string(),z.json()).nullable(),errorCode:opaqueKey.nullable(),materials:z.strictObject({logCursor:z.number().int().nonnegative(),outputRefs:z.array(z.strictObject({path:z.string().min(1),sha256:z.string().regex(/^[a-f0-9]{64}$/),byteSize:z.number().int().nonnegative()})).max(33)}).optional()}),
 inspect:z.strictObject({}),
};
export type RunnerStoreMethod=keyof typeof storeRequests;
export type StoreInput<M extends RunnerStoreMethod>=z.input<(typeof storeRequests)[M]>;
export interface InternalJob {job:Job;execution:{workspacePath:string;argv:string[]};leasePermit:Job['request']['permit'];leaseRenewedAt:string}
export interface StoreResults {
 register:Job;get:Job;byOperation:Job|null;pending:InternalJob[];active:InternalJob[];
 claim:InternalJob|null;stop:Job;renew:Job;record:Job;
 inspect:{version:number;runnerId:string;jobs:number;foreignKeyErrors:unknown[]};
}
