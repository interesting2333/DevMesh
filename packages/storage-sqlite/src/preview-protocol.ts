import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp,revision,previewImageIdentity} from '@devmesh/contracts';
const meta=z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()});
const read={principalId:opaqueKey,runId:ids.run};
const conditional={meta,runId:ids.run,ifMatch:z.string().optional()};
const bound={principalId:opaqueKey,operationId:ids.operation,requestHash:sha256};
export const previewBackendPolicy=z.strictObject({schemaVersion:z.literal('devmesh.preview-backend.v1'),backendPrincipalId:opaqueKey,backendRef:opaqueKey,runnerId:opaqueKey,templateVersion:opaqueKey,schemaRevision:opaqueKey,retentionDays:z.number().int().min(1).max(365),initialModes:z.array(z.enum(['EMPTY','DEMO'])).max(2),allowSnapshots:z.boolean()}).refine(p=>new Set(p.initialModes).size===p.initialModes.length);
const datasetReceipt=z.strictObject({kind:z.literal('DATASET_READY'),datasetId:ids.dataset,storageKey:z.string().regex(/^prj_[A-Za-z0-9_-]+\/dataset_[A-Za-z0-9_-]+\/app\.sqlite$/),originDatasetId:ids.dataset.nullable(),schemaRevision:opaqueKey,snapshotAt:timestamp,sha256,byteSize:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),integrity:z.literal('ok')});
const previewReceipt=z.strictObject({kind:z.literal('PREVIEW_READY'),previewId:ids.preview,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),instanceId:opaqueKey,healthy:z.literal(true),checkedAt:timestamp});
const stopReceipt=z.strictObject({kind:z.literal('PREVIEW_STOPPED'),previewId:ids.preview,instanceId:opaqueKey,exitVerified:z.literal(true),checkedAt:timestamp});
const removalReceipt=z.strictObject({kind:z.literal('PREVIEW_REMOVED'),previewId:ids.preview,instanceId:opaqueKey,removalVerified:z.literal(true),checkedAt:timestamp});
export const previewEffectReceipt=z.discriminatedUnion('kind',[datasetReceipt,previewReceipt,stopReceipt,removalReceipt]);
export const datasetPreparationRequest=z.strictObject({schemaVersion:z.literal('devmesh.dataset-prepare.v1'),operationId:ids.operation,projectId:ids.project,runId:ids.run,candidateId:ids.candidate,manifestHash:sha256,policyHash:sha256,backendRef:opaqueKey,runnerId:opaqueKey,datasetId:ids.dataset,storageKey:z.string().max(512),schemaRevision:opaqueKey,sourceDatasetId:ids.dataset.nullable(),sourceStorageKey:z.string().max(512).nullable(),sourceReleaseId:ids.release.nullable(),initialData:z.enum(['EMPTY','DEMO']).nullable(),templateVersion:opaqueKey}).superRefine((i,c)=>{
 if(i.storageKey!==i.projectId+'/'+i.datasetId+'/app.sqlite'||i.sourceDatasetId===i.datasetId)c.addIssue({code:'custom',message:'Exact distinct dataset storage identities required'});
 if(i.sourceDatasetId){if(i.sourceStorageKey!==i.projectId+'/'+i.sourceDatasetId+'/app.sqlite'||!i.sourceReleaseId||i.initialData!==null)c.addIssue({code:'custom',message:'Exact source release and dataset required'});}
 else if(i.sourceStorageKey!==null||i.sourceReleaseId!==null||i.initialData===null)c.addIssue({code:'custom',message:'Explicit initial data mode required'});
});
const previewSubject={operationId:ids.operation,projectId:ids.project,runId:ids.run,candidateId:ids.candidate,policyHash:sha256,backendRef:opaqueKey,runnerId:opaqueKey,previewId:ids.preview,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/)};
export const previewStartRequest=z.strictObject({schemaVersion:z.literal('devmesh.preview-start.v1'),...previewSubject,manifestHash:sha256,storageKey:z.string().max(512),datasetOperationId:ids.operation,templateVersion:opaqueKey,schemaRevision:opaqueKey,imageIdentity:previewImageIdentity,expiresAt:timestamp}).superRefine((i,c)=>{if(i.storageKey!==i.projectId+'/'+i.datasetId+'/app.sqlite'||i.imageIdentity.imageDigest!==i.imageDigest)c.addIssue({code:'custom',message:'Exact dataset and image identity required'});});
export const previewStopRequest=z.strictObject({schemaVersion:z.literal('devmesh.preview-stop.v1'),...previewSubject,startOperationId:ids.operation,startRequestHash:sha256,instanceId:opaqueKey,reason:z.enum(['USER','EXPIRED'])});
export const previewRuntimeFact=z.strictObject({previewId:ids.preview,datasetId:ids.dataset,imageDigest:previewSubject.imageDigest,state:z.enum(['HEALTHY','UNHEALTHY','CREATED','EXITED','REMOVED','UNKNOWN']),instanceId:opaqueKey.nullable(),endpoint:z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)}).nullable(),checkedAt:timestamp}).superRefine((i,c)=>{
  if((i.state==='UNKNOWN')!==(i.instanceId===null)||i.state==='HEALTHY'&&i.endpoint===null||['EXITED','REMOVED','CREATED','UNKNOWN'].includes(i.state)&&i.endpoint!==null)c.addIssue({code:'custom',message:'A runtime fact needs exact verified instance and endpoint evidence'});
});
const backendPage={principalId:opaqueKey,projectId:ids.project,policyHash:sha256,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)};
export const previewRequests={
 registerPreviewBackendPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policy:previewBackendPolicy}),
 getPreviewBackendPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256}),
 createPreviewDataset:z.strictObject({...conditional,candidateId:ids.candidate,manifestHash:sha256,policyHash:sha256}),
 getPreviewDataset:z.strictObject({...read,datasetId:ids.dataset}),
 createPreviewIntent:z.strictObject({...conditional,candidateId:ids.candidate,manifestHash:sha256,datasetId:ids.dataset,expiresAt:timestamp}),
 getPreview:z.strictObject({...read,previewId:ids.preview}),
 stopPreviewIntent:z.strictObject({meta,runId:ids.run,previewId:ids.preview,previewRevision:revision,impactReviewHash:sha256,reason:z.enum(['USER','EXPIRED'])}),
 getPreviewEffect:z.strictObject({principalId:opaqueKey,operationId:ids.operation}),
 listPreviewEffects:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20),states:z.array(z.enum(['PREPARED','SENT','UNKNOWN','SUCCEEDED','FAILED'])).min(1).max(5).default(['PREPARED','SENT','UNKNOWN'])}).refine(i=>new Set(i.states).size===i.states.length),
 markPreviewEffectSent:z.strictObject({...bound,expectedRevision:revision}),
 recordPreviewEffectObservation:z.strictObject({...bound,expectedRevision:revision,observation:z.discriminatedUnion('state',[
  z.strictObject({state:z.literal('UNKNOWN'),errorCode:opaqueKey}),
  z.strictObject({state:z.literal('FAILED'),errorCode:opaqueKey,absenceVerified:z.literal(true)}),
  z.strictObject({state:z.literal('SUCCEEDED'),receipt:previewEffectReceipt}),
 ])}),
 listPreviewEffectHistory:z.strictObject({...bound,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
  getPreviewLifecycle:z.strictObject({principalId:opaqueKey,previewId:ids.preview}),
  getPreviewLifecycleScope:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256}),
  listPreviewLifecycles:z.strictObject(backendPage),
  listPreviewDatasetWork:z.strictObject(backendPage),
  verifyPreviewExecution:z.strictObject(bound),
  recordPreviewRuntimeObservation:z.strictObject({...bound,expectedSequence:z.number().int().nonnegative(),fact:previewRuntimeFact}),
  listPreviewRuntimeHistory:z.strictObject({...bound,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
  preparePreviewExpiry:z.strictObject({principalId:opaqueKey,previewId:ids.preview}),
};
export type PreviewMethod=keyof typeof previewRequests;
export type PreviewInput<M extends PreviewMethod>=z.output<(typeof previewRequests)[M]>;
export type PreviewBackendPolicy=z.output<typeof previewBackendPolicy>;
export type PreviewEffectReceipt=z.output<typeof previewEffectReceipt>;
export type DatasetPreparationRequest=z.output<typeof datasetPreparationRequest>;
export type PreviewStartRequest=z.output<typeof previewStartRequest>;
export type PreviewStopRequest=z.output<typeof previewStopRequest>;
export type PreviewRuntimeFact=z.output<typeof previewRuntimeFact>;
export interface PreviewRuntimeObservation {sequence:number;fact:PreviewRuntimeFact;observedAt:string}
export type PreviewExecutionObservation={state:'UNKNOWN';errorCode:string}|{state:'FAILED';errorCode:string;absenceVerified:true}|{state:'SUCCEEDED';receipt:Extract<PreviewEffectReceipt,{kind:'PREVIEW_READY'|'PREVIEW_STOPPED'|'PREVIEW_REMOVED'}>};
export interface PreviewExecutionResult {observation:PreviewExecutionObservation;fact:PreviewRuntimeFact}
export interface PreviewExecutionBackend {
 readonly configured:boolean;
 preflight(effect:PreviewEffect,datasetEffect:PreviewEffect):Promise<void>;
 execute(effect:PreviewEffect,datasetEffect:PreviewEffect,authorize:()=>Promise<boolean>):Promise<PreviewExecutionResult>;
 inspect(effect:PreviewEffect):Promise<PreviewExecutionResult>;
}
export type DatasetPreparationObservation={state:'UNKNOWN';errorCode:string}|{state:'FAILED';errorCode:string;absenceVerified:true}|{state:'SUCCEEDED';receipt:Extract<PreviewEffectReceipt,{kind:'DATASET_READY'}>};
export interface DatasetPreparationBackend {
 readonly configured:boolean;
 preflight(effect:PreviewEffect):Promise<void>;
 prepare(effect:PreviewEffect,authorize?:()=>Promise<boolean>):Promise<DatasetPreparationObservation>;
 inspect(effect:PreviewEffect):Promise<DatasetPreparationObservation>;
}
export interface DatasetView {
 datasetId:string;projectId:string;runId:string;candidateId:string;operationId:string;policyHash:string;
 sourceDatasetId:string|null;sourceReleaseId:string|null;storageKey:string;schemaRevision:string;
 state:'PREPARING'|'READY'|'WRITE_FROZEN'|'RETIRED'|'MISSING';revision:number;snapshotAt:string|null;retentionUntil:string;createdAt:string;
}
export interface PreviewView {
 previewId:string;projectId:string;runId:string;candidateId:string;operationId:string;datasetId:string;policyHash:string;imageDigest:string;
 state:'STARTING'|'READY'|'STOPPING'|'STOPPED'|'EXPIRED'|'UNKNOWN';revision:number;instanceId:string|null;expiresAt:string;createdAt:string;
 impactReviewHash:string;stopOperationId:string|null;availability:'AVAILABLE'|'UNAVAILABLE';
  healthState:PreviewRuntimeFact['state'];healthCheckedAt:string|null;
}
export interface PreviewLifecycle {preview:PreviewView;startEffect:PreviewEffect;datasetEffect:PreviewEffect;stopEffect:PreviewEffect|null;runtime:PreviewRuntimeObservation|null;accepted:boolean}
export interface PreviewEffect {
 operationId:string;projectId:string;runId:string;candidateId:string;datasetId:string;previewId:string|null;policyHash:string;
 kind:'DATASET_PREPARE'|'PREVIEW_START'|'PREVIEW_STOP';remoteKey:string;requestHash:string;request:Record<string,unknown>;
 state:'PREPARED'|'SENT'|'UNKNOWN'|'SUCCEEDED'|'FAILED';revision:number;receipt:PreviewEffectReceipt|null;errorCode:string|null;createdAt:string;
}
export interface PreviewResults {
 registerPreviewBackendPolicy:{policyHash:string;policy:PreviewBackendPolicy};getPreviewBackendPolicy:{policyHash:string;policy:PreviewBackendPolicy};
 createPreviewDataset:DatasetView;getPreviewDataset:DatasetView;createPreviewIntent:PreviewView;getPreview:PreviewView;stopPreviewIntent:PreviewView;
 getPreviewEffect:PreviewEffect;markPreviewEffectSent:{dispatch:boolean;effect:PreviewEffect};recordPreviewEffectObservation:PreviewEffect;
 listPreviewEffects:{items:{sequence:number;effect:PreviewEffect}[];nextSequence:number|null};
 listPreviewEffectHistory:{items:{sequence:number;observation:PreviewInput<'recordPreviewEffectObservation'>['observation'];observedAt:string}[];nextSequence:number|null};
  getPreviewLifecycle:PreviewLifecycle;
  getPreviewLifecycleScope:{policyHash:string;policy:PreviewBackendPolicy};
  listPreviewLifecycles:{items:{sequence:number;lifecycle:PreviewLifecycle}[];nextSequence:number|null};
  listPreviewDatasetWork:{items:{sequence:number;effect:PreviewEffect}[];nextSequence:number|null};
  verifyPreviewExecution:{allowed:boolean;reasonCode:string|null};
  recordPreviewRuntimeObservation:PreviewRuntimeObservation;
  listPreviewRuntimeHistory:{items:PreviewRuntimeObservation[];nextSequence:number|null};
  preparePreviewExpiry:PreviewView;
}
