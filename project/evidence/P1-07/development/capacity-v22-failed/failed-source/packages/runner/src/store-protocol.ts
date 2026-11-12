import { z } from 'zod';
import { opaqueKey } from '@devmesh/contracts';
import { startJob,renewJob } from './protocol.js';
import type { Job } from './protocol.js';
import {acquireWorkspaceFence,releaseWorkspaceFence,workspaceBindingSchema} from './workspace-fence.js';
import type {WorkspaceFence,WorkspaceBinding} from './workspace-fence.js';
import {previewRuntimeFact} from '@devmesh/storage-sqlite';
import {reservePreview,runnerCapacity} from './preview-reservation.js';
import type {PreviewReservation,RunnerCapacity,RunnerCapacityUsage} from './preview-reservation.js';
const owner={controllerId:opaqueKey};
export const storeRequests={
 capacityConfigure:runnerCapacity,
 capacityUsage:z.strictObject({}),
 previewReserve:z.strictObject({...owner,...reservePreview.shape}),
 previewReservationGet:z.strictObject({...owner,reservationId:opaqueKey}),
 previewReservationByOperation:z.strictObject({...owner,operationId:opaqueKey}),
 previewReservationPage:z.strictObject({...owner,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
 previewReservationDispatch:z.strictObject({...owner,reservationId:opaqueKey,requestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewReservationCancel:z.strictObject({...owner,reservationId:opaqueKey,requestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewReservationRecord:z.strictObject({...owner,reservationId:opaqueKey,requestHash:z.string().regex(/^[a-f0-9]{64}$/),expectedRevision:z.number().int().nonnegative(),fact:previewRuntimeFact}),
 fenceAcquire:z.strictObject({...owner,request:acquireWorkspaceFence,workspacePath:z.string().min(1),binding:workspaceBindingSchema}),
 fenceGet:z.strictObject({...owner,fenceId:opaqueKey}),
 fenceByOperation:z.strictObject({...owner,operationId:opaqueKey}),
 fenceActive:z.strictObject({...owner,workspaceRef:opaqueKey}),
 fenceRelease:z.strictObject({...owner,fenceId:opaqueKey,release:releaseWorkspaceFence}),
 workspaceBinding:z.strictObject({workspaceRef:opaqueKey}),
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
 capacityConfigure:RunnerCapacity;
 capacityUsage:{capacity:RunnerCapacity|null;usage:RunnerCapacityUsage};
 previewReserve:PreviewReservation;previewReservationGet:PreviewReservation;previewReservationByOperation:PreviewReservation|null;
 previewReservationPage:{items:{sequence:number;reservation:PreviewReservation}[];nextSequence:number|null};
 previewReservationDispatch:{dispatch:boolean;reservation:PreviewReservation};previewReservationCancel:PreviewReservation;previewReservationRecord:PreviewReservation;
 fenceAcquire:WorkspaceFence;fenceGet:WorkspaceFence;fenceByOperation:WorkspaceFence|null;fenceActive:WorkspaceFence|null;fenceRelease:WorkspaceFence;workspaceBinding:WorkspaceBinding|null;
 register:Job;get:Job;byOperation:Job|null;pending:InternalJob[];active:InternalJob[];
 claim:InternalJob|null;stop:Job;renew:Job;record:Job;
 inspect:{version:number;runnerId:string;jobs:number;foreignKeyErrors:unknown[]};
}
