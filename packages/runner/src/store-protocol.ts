import { z } from 'zod';
import { opaqueKey } from '@devmesh/contracts';
import { startJob,renewJob } from './protocol.js';
import type { Job } from './protocol.js';
import {acquireWorkspaceFence,releaseWorkspaceFence,workspaceBindingSchema} from './workspace-fence.js';
import type {WorkspaceFence,WorkspaceBinding} from './workspace-fence.js';
import {previewRuntimeFact} from '@devmesh/storage-sqlite';
import {reservePreview,runnerCapacity} from './preview-reservation.js';
import type {PreviewReservation,RunnerCapacity,RunnerCapacityUsage} from './preview-reservation.js';
import {previewContainerProfile,previewContainerActionRequest,previewContainerAction,previewContainerObservation} from './preview-container.js';
import type {PreviewContainerJournal} from './preview-container.js';
import {previewReleaseClaim} from './preview-lifecycle.js';
import type {RunnerPreviewLifecycle} from './preview-lifecycle.js';
import {previewCleanupKind,previewCleanupObservation} from './preview-cleanup.js';
import type {PreviewCleanupAction} from './preview-cleanup.js';
import {acceptanceServiceClaim} from '@devmesh/storage-sqlite';
import type {AcceptancePreparedProof} from '@devmesh/storage-sqlite';
import {reserveAcceptanceService,acceptanceServiceFact,acceptanceServiceProfile,acceptanceServiceActionKind,acceptanceServiceActionObservation} from './acceptance-service.js';
import type {AcceptanceServiceReservation,AcceptanceServiceJournal} from './acceptance-service.js';
import {acceptanceAbortStoreRequests} from './acceptance-abort.js';
import type {AcceptanceAbortStoreResults} from './acceptance-abort.js';
const owner={controllerId:opaqueKey};
const previewBound={...owner,reservationId:opaqueKey,requestHash:z.string().regex(/^[a-f0-9]{64}$/)};
export const storeRequests={
 ...acceptanceAbortStoreRequests,
 acceptanceServiceReserve:z.strictObject({...owner,...reserveAcceptanceService.shape}),
 acceptanceServiceGet:z.strictObject(previewBound),
 acceptanceServiceByOperation:z.strictObject({...owner,operationId:opaqueKey}),
 acceptanceServicePage:z.strictObject({...owner,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
 acceptanceServiceDispatch:z.strictObject(previewBound),
 acceptanceServiceCancel:z.strictObject(previewBound),
 acceptanceServiceRecord:z.strictObject({...previewBound,expectedRevision:z.number().int().nonnegative().safe(),fact:acceptanceServiceFact}),
 acceptanceServiceProfilePrepare:z.strictObject({...previewBound,profile:acceptanceServiceProfile}),
 acceptanceServiceJournal:z.strictObject(previewBound),
 acceptanceServiceActionBegin:z.strictObject({...previewBound,kind:acceptanceServiceActionKind}),
 acceptanceServiceActionAuthorized:z.strictObject({...previewBound,kind:acceptanceServiceActionKind,actionRequestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 acceptanceServiceActionObserve:z.strictObject({...previewBound,kind:acceptanceServiceActionKind,actionRequestHash:z.string().regex(/^[a-f0-9]{64}$/),observation:acceptanceServiceActionObservation}),
 acceptanceServiceHold:z.strictObject({...previewBound,claim:acceptanceServiceClaim,claimHash:z.string().regex(/^[a-f0-9]{64}$/)}),
  acceptanceServicePrepareProof:z.strictObject(previewBound),
 previewCleanupGet:z.strictObject(previewBound),
 previewCleanupPage:z.strictObject({...owner,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
 previewCleanupActionBegin:z.strictObject({...previewBound,kind:previewCleanupKind}),
 previewCleanupActionAuthorized:z.strictObject({...previewBound,kind:previewCleanupKind,actionRequestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewCleanupActionObserve:z.strictObject({...previewBound,kind:previewCleanupKind,actionRequestHash:z.string().regex(/^[a-f0-9]{64}$/),observation:previewCleanupObservation}),
 previewLifecycleEnroll:z.strictObject(previewBound),
 previewLifecycleGet:z.strictObject(previewBound),
 previewExpiryPrepare:z.strictObject(previewBound),
 previewExpiryAuthorized:z.strictObject({...previewBound,expiryRequestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewLifecycleActionAuthorized:z.strictObject({...previewBound,kind:previewContainerAction,actionRequestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewReleaseHold:z.strictObject({...previewBound,claim:previewReleaseClaim,claimHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewReleaseCommit:z.strictObject({...previewBound,claimHash:z.string().regex(/^[a-f0-9]{64}$/),releaseId:opaqueKey,acceptanceOperationId:opaqueKey,acceptanceRequestHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 previewContainerPrepare:z.strictObject({...previewBound,profile:previewContainerProfile}),
 previewContainerGet:z.strictObject(previewBound),
 previewContainerActionBegin:z.strictObject({...previewBound,action:previewContainerActionRequest}),
 previewContainerActionObserve:z.strictObject({...previewBound,kind:previewContainerAction,actionRequestHash:z.string().regex(/^[a-f0-9]{64}$/),observation:previewContainerObservation}),
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
export interface StoreResults extends AcceptanceAbortStoreResults {
 acceptanceServiceReserve:AcceptanceServiceReservation;acceptanceServiceGet:AcceptanceServiceReservation;acceptanceServiceByOperation:AcceptanceServiceReservation|null;
 acceptanceServicePage:{items:{sequence:number;reservation:AcceptanceServiceReservation}[];nextSequence:number|null};
 acceptanceServiceDispatch:{dispatch:boolean;reservation:AcceptanceServiceReservation};acceptanceServiceCancel:AcceptanceServiceReservation;acceptanceServiceRecord:AcceptanceServiceReservation;
 acceptanceServiceProfilePrepare:AcceptanceServiceJournal;acceptanceServiceJournal:AcceptanceServiceJournal|null;
 acceptanceServiceActionBegin:{dispatch:boolean;journal:AcceptanceServiceJournal};acceptanceServiceActionAuthorized:{allowed:boolean};acceptanceServiceActionObserve:AcceptanceServiceJournal;
 acceptanceServiceHold:AcceptanceServiceReservation;
  acceptanceServicePrepareProof:AcceptancePreparedProof;
 previewCleanupGet:PreviewCleanupAction[];previewCleanupActionBegin:{dispatch:boolean;action:PreviewCleanupAction};previewCleanupActionAuthorized:{allowed:boolean};previewCleanupActionObserve:PreviewCleanupAction;
 previewCleanupPage:{items:{sequence:number;reservationId:string;requestHash:string}[];nextSequence:number|null};
 previewLifecycleEnroll:RunnerPreviewLifecycle;previewLifecycleGet:RunnerPreviewLifecycle|null;previewExpiryPrepare:RunnerPreviewLifecycle|null;
 previewExpiryAuthorized:{allowed:boolean};previewLifecycleActionAuthorized:{allowed:boolean};previewReleaseHold:RunnerPreviewLifecycle;previewReleaseCommit:RunnerPreviewLifecycle;
 previewContainerPrepare:PreviewContainerJournal;previewContainerGet:PreviewContainerJournal|null;
 previewContainerActionBegin:{dispatch:boolean;journal:PreviewContainerJournal};previewContainerActionObserve:PreviewContainerJournal;
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
