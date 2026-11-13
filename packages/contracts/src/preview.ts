import {z} from 'zod';
import {ids,revision,timestamp,sha256,opaqueKey} from './primitives.js';
import {deliveryDataPlan} from './delivery.js';
const secureOrigin=z.url().refine(value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.origin===value;}catch{return false;}},{message:'Expected canonical HTTPS origin'});
export const previewAccessInput=z.strictObject({});
export const previewAccessTicket=z.strictObject({ticket:z.string().regex(/^dmp_ticket\.[A-Za-z0-9_-]{43}$/),previewOrigin:secureOrigin,expiresAt:timestamp,sessionExpiresAt:timestamp});
export const previewEntryView=z.strictObject({
  preview:z.strictObject({previewId:ids.preview,runId:ids.run,candidateId:ids.candidate,datasetId:ids.dataset,revision,state:z.enum(['STARTING','READY','STOPPING','STOPPED','EXPIRED','UNKNOWN']),expiresAt:timestamp,healthState:z.enum(['HEALTHY','UNHEALTHY','CREATED','EXITED','REMOVED','UNKNOWN']),healthCheckedAt:timestamp.nullable()}),
  access:z.strictObject({state:z.enum(['AVAILABLE','NOT_CONFIGURED','RECOVERING','STARTING','STOPPING','STOPPED','EXPIRED','UNKNOWN']),canWrite:z.boolean(),previewOrigin:secureOrigin.nullable()}),
}).superRefine((value,ctx)=>{if((value.access.state==='AVAILABLE')!==(value.access.previewOrigin!==null)||value.access.canWrite&&value.access.state!=='AVAILABLE')ctx.addIssue({code:'custom',message:'Only available access has a preview origin or write authority'});});
export type PreviewEntryView=z.output<typeof previewEntryView>;
export const createPreviewDatasetInput=z.strictObject({manifestHash:sha256,policyHash:sha256});
export const createPreviewIntentInput=z.strictObject({manifestHash:sha256,datasetId:ids.dataset,expiresAt:timestamp});
export const stopPreviewIntentInput=z.strictObject({previewRevision:revision,impactReviewHash:sha256,confirmation:z.literal('STOP_PREVIEW')});
export const previewDatasetManagement=z.strictObject({datasetId:ids.dataset,runId:ids.run,candidateId:ids.candidate,operationId:ids.operation,state:z.enum(['PREPARING','READY','WRITE_FROZEN','RETIRED','MISSING']),operationState:z.enum(['PREPARED','SENT','UNKNOWN','SUCCEEDED','FAILED']),revision,sourceDatasetId:ids.dataset.nullable(),sourceReleaseId:ids.release.nullable(),schemaRevision:opaqueKey,snapshotAt:timestamp.nullable(),retentionUntil:timestamp,createdAt:timestamp,canStart:z.boolean()});
export const previewManagement=previewEntryView.shape.preview.extend({operationId:ids.operation,impactReviewHash:sha256,stopOperationId:ids.operation.nullable(),canStop:z.boolean()});
export const candidatePreviewWorkspace=z.strictObject({projectId:ids.project,runId:ids.run,candidateId:ids.candidate,candidateRevision:revision,manifestHash:sha256,qualification:z.enum(['CURRENT','STALE']),resourceRevision:revision,dataPlan:deliveryDataPlan,canManage:z.boolean(),configured:z.boolean(),policyHash:sha256.nullable(),canCreateDataset:z.boolean(),hasPendingEffects:z.boolean(),datasets:z.array(z.strictObject({sequence:revision,dataset:previewDatasetManagement})).max(20),nextDatasetSequence:revision.nullable(),previews:z.array(z.strictObject({sequence:revision,preview:previewManagement})).max(20),nextPreviewSequence:revision.nullable()});
export type CandidatePreviewWorkspace=z.output<typeof candidatePreviewWorkspace>;
