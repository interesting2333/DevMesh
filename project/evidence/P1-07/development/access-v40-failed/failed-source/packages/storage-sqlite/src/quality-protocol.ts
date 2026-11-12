import {z} from 'zod';
import {ids,opaqueKey,sha256,qualityPolicy,qualityExecution,qualityReport,qualityEvaluation} from '@devmesh/contracts';
import type {QualityPolicy,QualityExecution,QualityEvaluation} from '@devmesh/contracts';
import type {SourceManifest} from './workspace-protocol.js';
import type {PipelineInput} from './pipeline-protocol.js';
const subject={operationId:ids.operation,principalId:opaqueKey};
const bound={...subject,requestHash:sha256};
export const qualityMaterialTarget={operationId:ids.operation,materialKey:z.string().min(1).max(256).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)};
const bytes={sha256,byteSize:z.number().int().min(0).max(16*1024*1024)};
export const qualityMaterialDescriptor=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('SOURCE'),...bytes,sourceManifestSha256:sha256,topologySha256:sha256,allocationManifestSha256:sha256,instrumentation:z.strictObject({providerId:opaqueKey,toolchainHash:sha256}).optional()}),
 z.strictObject({kind:z.literal('REPORT'),...bytes,report:qualityReport}),
 z.strictObject({kind:z.literal('LOG'),...bytes,producerId:opaqueKey}),
 z.strictObject({kind:z.literal('RESULT'),...bytes,evaluation:qualityEvaluation}),
]);
export type QualityMaterialDescriptor=z.output<typeof qualityMaterialDescriptor>;
export const qualityMaterialKey=(d:QualityMaterialDescriptor):string=>d.kind==='SOURCE'?'source':d.kind==='RESULT'?'result':d.kind==='REPORT'?'report.'+d.report.reportId:'log.'+d.producerId;
export const qualityRequests={
 registerQualityPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policy:qualityPolicy}),
 getQualityPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,configHash:sha256}),
 beginQualityVerification:z.strictObject({...subject,runId:ids.run,attemptId:ids.attempt,allocationOperationId:ids.operation,configHash:sha256}),
 getQualityVerification:z.strictObject(subject),
  getQualitySourceManifest:z.strictObject(bound),
  bindQualityStage:z.strictObject({...bound,producerId:opaqueKey,pipelineId:opaqueKey,ordinal:z.number().int().min(0).max(7)}),
  listQualityStages:z.strictObject(bound),
 declareQualityOrigin:z.strictObject({...bound,producerId:opaqueKey,pipelineId:opaqueKey,ordinal:z.number().int().min(0).max(7),execution:qualityExecution}),
 declareQualityMaterial:z.strictObject({...bound,descriptor:qualityMaterialDescriptor}),
 listQualityMaterials:z.strictObject({...subject,afterKey:z.string().max(256).default(''),limit:z.number().int().min(1).max(100).default(50)}),
 completeQualityVerification:z.strictObject(bound),
  publishQualityArtifacts:z.strictObject({...bound,contentHashes:z.array(sha256).min(1).max(50)}),
};
export type QualityMethod=keyof typeof qualityRequests;
export type QualityInput<M extends QualityMethod>=z.output<(typeof qualityRequests)[M]>;
export interface QualityBasis {attemptId:string;workId:string;workRevision:number;workEpoch:number;runEpoch:number;planRevision:number;requirementRevision:number;inputFingerprint:string;inputManifest:Record<string,unknown>;allocationOperationId:string;allocationRequestHash:string;allocationManifestSha256:string;sourceIntegrationOperationId:string;sourceBasisSha256:string;runnerId:string;workspaceRef:string;targetCommit:string}
export interface QualityOrigin {producerId:string;pipelineId:string;ordinal:number;execution:QualityExecution}
export interface QualityVerification {operationId:string;principalId:string;projectId:string;runId:string;attemptId:string;allocationOperationId:string;configHash:string;requestHash:string;basis:QualityBasis;state:'PREPARED'|'EVALUATED';qualification:'CURRENT'|'STALE';evaluation:QualityEvaluation|null;origins:QualityOrigin[]}
export interface QualityMaterial {operationId:string;materialKey:string;descriptor:QualityMaterialDescriptor;writeKey:string;contentHash:string|null;writeId:string|null}
export interface QualityStage {producerId:string;pipelineId:string;ordinal:number;operationId:string;state:string;job:PipelineInput<'recordPipelineStage'>['job']|null}
export interface QualityArtifactRef {materialKey:string;artifactId:string;sha256:string;targetCommit:string}
export interface QualityResults {
 registerQualityPolicy:{configHash:string;policy:QualityPolicy};getQualityPolicy:{configHash:string;policy:QualityPolicy};
 beginQualityVerification:QualityVerification;getQualityVerification:QualityVerification;declareQualityOrigin:QualityOrigin;
  getQualitySourceManifest:SourceManifest;bindQualityStage:QualityStage;listQualityStages:QualityStage[];
 declareQualityMaterial:QualityMaterial;listQualityMaterials:QualityMaterial[];completeQualityVerification:QualityVerification;
  publishQualityArtifacts:QualityArtifactRef[];
}
