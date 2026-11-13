import {z} from 'zod';
import {ids,opaqueKey,sha256,revision,epoch,gitCommit,previewImageIdentity,deliveryDataPlan} from '@devmesh/contracts';
import type {DatasetView} from './preview-protocol.js';
import type {acceptanceBasisView} from '@devmesh/contracts';
import type {PreviewWriteGate,previewWriteCloseRequest} from './preview-access-protocol.js';
const meta=z.strictObject({principalId:opaqueKey,scopeId:opaqueKey,idempotencyKey:z.uuid()});
const conditional={meta,runId:ids.run,ifMatch:z.string().optional()};
const candidate={candidateId:ids.candidate,candidateRevision:revision,manifestHash:sha256,reviewHash:sha256,expectedAcceptedReleaseId:ids.release.nullable(),dataPlanHash:sha256};
const bound={principalId:opaqueKey,operationId:ids.operation,requestHash:sha256};
export const acceptanceBackendPolicy=z.strictObject({schemaVersion:z.literal('devmesh.acceptance-backend.v1'),backendPrincipalId:opaqueKey,backendRef:opaqueKey,runnerId:opaqueKey,templateVersion:opaqueKey,schemaRevision:opaqueKey,initialModes:z.array(z.enum(['EMPTY','DEMO'])).max(2),allowPreserveMigration:z.boolean(),allowReplacement:z.boolean()}).refine(p=>new Set(p.initialModes).size===p.initialModes.length);
export const acceptancePreparationRequest=z.strictObject({
  schemaVersion:z.literal('devmesh.acceptance-prepare.v1'),operationId:ids.operation,releaseId:ids.release,
  projectId:ids.project,runId:ids.run,...candidate,runEpoch:epoch,requirementRevision:revision,planRevision:revision,codeCommit:gitCommit,
  image:previewImageIdentity,dataPlan:deliveryDataPlan,policyHash:sha256,backendPrincipalId:opaqueKey,backendRef:opaqueKey,runnerId:opaqueKey,
  source:z.strictObject({releaseId:ids.release,datasetId:ids.dataset,datasetOperationId:ids.operation,storageKey:z.string().max(512),schemaRevision:opaqueKey}).nullable(),
  target:z.strictObject({datasetId:ids.dataset,storageKey:z.string().max(512),schemaRevision:opaqueKey}),
}).superRefine((i,c)=>{
  if(i.image.targetCommit!==i.codeCommit||i.dataPlan.codeCommit!==i.codeCommit||i.dataPlan.runId!==i.runId||i.dataPlan.requirementRevision!==i.requirementRevision||i.dataPlan.planRevision!==i.planRevision||i.dataPlan.sourceReleaseId!==i.expectedAcceptedReleaseId||i.target.storageKey!==i.projectId+'/'+i.target.datasetId+'/app.sqlite')c.addIssue({code:'custom',message:'Exact candidate, data plan and derived target required'});
  if((i.source?.releaseId??null)!==i.expectedAcceptedReleaseId||i.source&&(i.source.datasetId===i.target.datasetId||i.source.storageKey!==i.projectId+'/'+i.source.datasetId+'/app.sqlite'))c.addIssue({code:'custom',message:'Exact distinct original accepted source required'});
});
export const acceptanceRequests={
  getCandidateAcceptanceBasis:z.strictObject({principalId:opaqueKey,runId:ids.run,candidateId:ids.candidate,policyHash:sha256.optional()}),
  listCandidateAcceptancePreparations:z.strictObject({principalId:opaqueKey,runId:ids.run,candidateId:ids.candidate,afterSequence:z.number().int().nonnegative().safe().default(0),limit:z.number().int().min(1).max(100).default(20)}),
  registerAcceptanceBackendPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policy:acceptanceBackendPolicy}),
  recordAcceptanceReplacementDecision:z.strictObject({...conditional,...candidate,decisionId:ids.decision,confirmation:z.literal('REPLACE_ACCEPTED_DATA')}),
  beginAcceptancePreparation:z.strictObject({...conditional,...candidate,policyHash:sha256}),
  getAcceptancePreparation:z.strictObject({principalId:opaqueKey,operationId:ids.operation}),
  getAcceptanceDataset:z.strictObject(bound),
  closeAcceptanceSourceWriteGate:z.strictObject({...bound,expectedRevision:revision,expectedFence:z.number().int().nonnegative().safe()}),
  listAcceptancePreparations:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
  markAcceptancePreparationSent:z.strictObject({...bound,expectedRevision:revision}),
  markAcceptancePreparationUnknown:z.strictObject({...bound,expectedRevision:revision,errorCode:opaqueKey}),
  failUnsentAcceptancePreparation:z.strictObject({...conditional,operationId:ids.operation,requestHash:sha256}),
  listAcceptancePreparationHistory:z.strictObject({...bound,afterSequence:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type AcceptancePreparationRequest=z.output<typeof acceptancePreparationRequest>;
export type AcceptanceMethod=keyof typeof acceptanceRequests;
export type AcceptanceInput<M extends AcceptanceMethod>=z.output<(typeof acceptanceRequests)[M]>;
export interface AcceptancePreparation {
  operationId:string;projectId:string;runId:string;candidateId:string;policyHash:string;releaseId:string;requestHash:string;request:AcceptancePreparationRequest;
  state:'PREPARED'|'SENT'|'UNKNOWN'|'FAILED';revision:number;qualification:'CURRENT'|'STALE';errorCode:string|null;createdAt:string;updatedAt:string;
  resolution:'UNRESOLVED'|'UNSENT_FAILED'|'COMMITTED'|'ABORTING'|'ABORTED';acceptanceOperationId:string|null;
}
export interface AcceptanceResults {
  getCandidateAcceptanceBasis:z.output<typeof acceptanceBasisView>;
  listCandidateAcceptancePreparations:{items:{sequence:number;preparation:AcceptancePreparation}[];nextSequence:number|null};
  getAcceptanceDataset:{dataset:DatasetView;purpose:'ACCEPTANCE';baseReleaseId:string|null;requestHash:string;gate:PreviewWriteGate};
  closeAcceptanceSourceWriteGate:{gate:PreviewWriteGate;closeRequest:z.output<typeof previewWriteCloseRequest>;current:boolean};
  registerAcceptanceBackendPolicy:{policyHash:string;policy:z.output<typeof acceptanceBackendPolicy>};
  recordAcceptanceReplacementDecision:{decisionId:string;operationId:string};
  beginAcceptancePreparation:AcceptancePreparation;getAcceptancePreparation:AcceptancePreparation;
  listAcceptancePreparations:{items:{sequence:number;preparation:AcceptancePreparation}[];nextSequence:number|null};
  markAcceptancePreparationSent:{dispatch:boolean;preparation:AcceptancePreparation};markAcceptancePreparationUnknown:AcceptancePreparation;
  failUnsentAcceptancePreparation:AcceptancePreparation;
  listAcceptancePreparationHistory:{items:{sequence:number;snapshot:{state:AcceptancePreparation['state'];revision:number;errorCode:string|null;observedAt:string}}[];nextSequence:number|null};
}
