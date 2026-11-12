import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp,revision} from '@devmesh/contracts';
const meta=z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()});
const read={principalId:opaqueKey,runId:ids.run};
const conditional={meta,runId:ids.run,ifMatch:z.string().optional()};
const bound={principalId:opaqueKey,operationId:ids.operation,requestHash:sha256};
export const previewBackendPolicy=z.strictObject({schemaVersion:z.literal('devmesh.preview-backend.v1'),backendPrincipalId:opaqueKey,backendRef:opaqueKey,runnerId:opaqueKey,templateVersion:opaqueKey,schemaRevision:opaqueKey,retentionDays:z.number().int().min(1).max(365),initialModes:z.array(z.enum(['EMPTY','DEMO'])).max(2),allowSnapshots:z.boolean()}).refine(p=>new Set(p.initialModes).size===p.initialModes.length);
const datasetReceipt=z.strictObject({kind:z.literal('DATASET_READY'),datasetId:ids.dataset,storageKey:z.string().regex(/^prj_[A-Za-z0-9_-]+\/dataset_[A-Za-z0-9_-]+\/app\.sqlite$/),originDatasetId:ids.dataset.nullable(),schemaRevision:opaqueKey,snapshotAt:timestamp,sha256,byteSize:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),integrity:z.literal('ok')});
const previewReceipt=z.strictObject({kind:z.literal('PREVIEW_READY'),previewId:ids.preview,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),instanceId:opaqueKey,healthy:z.literal(true),checkedAt:timestamp});
const stopReceipt=z.strictObject({kind:z.literal('PREVIEW_STOPPED'),previewId:ids.preview,instanceId:opaqueKey,exitVerified:z.literal(true),checkedAt:timestamp});
export const previewEffectReceipt=z.discriminatedUnion('kind',[datasetReceipt,previewReceipt,stopReceipt]);
export const previewRequests={
 registerPreviewBackendPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policy:previewBackendPolicy}),
 getPreviewBackendPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256}),
 createPreviewDataset:z.strictObject({...conditional,candidateId:ids.candidate,manifestHash:sha256,policyHash:sha256}),
 getPreviewDataset:z.strictObject({...read,datasetId:ids.dataset}),
 createPreviewIntent:z.strictObject({...conditional,candidateId:ids.candidate,manifestHash:sha256,datasetId:ids.dataset,expiresAt:timestamp}),
 getPreview:z.strictObject({...read,previewId:ids.preview}),
 stopPreviewIntent:z.strictObject({meta,runId:ids.run,previewId:ids.preview,previewRevision:revision,impactReviewHash:sha256,reason:z.enum(['USER','EXPIRED'])}),
 getPreviewEffect:z.strictObject({principalId:opaqueKey,operationId:ids.operation}),
 markPreviewEffectSent:z.strictObject({...bound,expectedRevision:revision}),
 recordPreviewEffectObservation:z.strictObject({...bound,expectedRevision:revision,observation:z.discriminatedUnion('state',[
  z.strictObject({state:z.literal('UNKNOWN'),errorCode:opaqueKey}),
  z.strictObject({state:z.literal('FAILED'),errorCode:opaqueKey,absenceVerified:z.literal(true)}),
  z.strictObject({state:z.literal('SUCCEEDED'),receipt:previewEffectReceipt}),
 ])}),
 listPreviewEffectHistory:z.strictObject({...bound,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type PreviewMethod=keyof typeof previewRequests;
export type PreviewInput<M extends PreviewMethod>=z.output<(typeof previewRequests)[M]>;
export type PreviewBackendPolicy=z.output<typeof previewBackendPolicy>;
export type PreviewEffectReceipt=z.output<typeof previewEffectReceipt>;
export interface DatasetView {
 datasetId:string;projectId:string;runId:string;candidateId:string;operationId:string;policyHash:string;
 sourceDatasetId:string|null;sourceReleaseId:string|null;storageKey:string;schemaRevision:string;
 state:'PREPARING'|'READY'|'WRITE_FROZEN'|'RETIRED'|'MISSING';revision:number;snapshotAt:string|null;retentionUntil:string;createdAt:string;
}
export interface PreviewView {
 previewId:string;projectId:string;runId:string;candidateId:string;operationId:string;datasetId:string;policyHash:string;imageDigest:string;
 state:'STARTING'|'READY'|'STOPPING'|'STOPPED'|'EXPIRED'|'UNKNOWN';revision:number;instanceId:string|null;expiresAt:string;createdAt:string;
 impactReviewHash:string;stopOperationId:string|null;availability:'AVAILABLE'|'UNAVAILABLE';
}
export interface PreviewEffect {
 operationId:string;projectId:string;runId:string;candidateId:string;datasetId:string;previewId:string|null;policyHash:string;
 kind:'DATASET_PREPARE'|'PREVIEW_START'|'PREVIEW_STOP';remoteKey:string;requestHash:string;request:Record<string,unknown>;
 state:'PREPARED'|'SENT'|'UNKNOWN'|'SUCCEEDED'|'FAILED';revision:number;receipt:PreviewEffectReceipt|null;errorCode:string|null;createdAt:string;
}
export interface PreviewResults {
 registerPreviewBackendPolicy:{policyHash:string;policy:PreviewBackendPolicy};getPreviewBackendPolicy:{policyHash:string;policy:PreviewBackendPolicy};
 createPreviewDataset:DatasetView;getPreviewDataset:DatasetView;createPreviewIntent:PreviewView;getPreview:PreviewView;stopPreviewIntent:PreviewView;
 getPreviewEffect:PreviewEffect;markPreviewEffectSent:{dispatch:boolean;effect:PreviewEffect};recordPreviewEffectObservation:PreviewEffect;
 listPreviewEffectHistory:{items:{sequence:number;observation:PreviewInput<'recordPreviewEffectObservation'>['observation'];observedAt:string}[];nextSequence:number|null};
}
