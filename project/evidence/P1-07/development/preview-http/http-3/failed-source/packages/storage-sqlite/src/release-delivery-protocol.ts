import {z} from 'zod';
import {ids,opaqueKey,sha256,releaseDeliveryPolicy,deliveryDataPlan,previewImageIdentity} from '@devmesh/contracts';
import type {ReleaseDeliveryPolicy,DeliveryDataPlan} from '@devmesh/contracts';
import type {PipelineInput} from './pipeline-protocol.js';
const subject={principalId:opaqueKey,operationId:ids.operation},bound={...subject,requestHash:sha256};
export const releaseDeliveryTarget={operationId:ids.operation,materialKey:opaqueKey};
export const releaseDeliveryRequests={
 registerReleaseDeliveryPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policy:releaseDeliveryPolicy}),
 getReleaseDeliveryPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256}),
 beginReleaseDelivery:z.strictObject({...subject,runId:ids.run,qualityOperationId:ids.operation,policyHash:sha256}),
 getReleaseDelivery:z.strictObject(subject),
 getReleaseDeliveryOrigin:z.strictObject(bound),
 listReleaseDeliveryMaterials:z.strictObject(subject),
 completeReleaseDelivery:z.strictObject({...bound,image:previewImageIdentity,dataPlan:deliveryDataPlan}),
};
export type ReleaseDeliveryMethod=keyof typeof releaseDeliveryRequests;
export type ReleaseDeliveryInput<M extends ReleaseDeliveryMethod>=z.output<(typeof releaseDeliveryRequests)[M]>;
export interface ReleaseDeliveryMaterial {operationId:string;materialKey:string;path:string;outputIndex:number;expectedHash:string;byteSize:number;writeKey:string;contentHash:string|null;writeId:string|null}
export interface ReleaseDeliveryBasis {runId:string;runEpoch:number;planRevision:number;requirementRevision:number;targetCommit:string;sourceManifestSha256:string;checkConfigHash:string;templateVersion:string;qualityOperationId:string;qualityBasisSha256:string;qualityResultHash:string;attemptId:string;workEpoch:number;jobHash:string;sourceReleaseId:string|null}
export interface ReleaseDelivery {operationId:string;principalId:string;projectId:string;runId:string;requestHash:string;policyHash:string;basis:ReleaseDeliveryBasis;state:'PREPARED'|'READY';qualification:'CURRENT'|'STALE';image:z.output<typeof previewImageIdentity>|null;dataPlan:DeliveryDataPlan|null}
export interface ReleaseDeliveryResults {
 registerReleaseDeliveryPolicy:{policyHash:string;policy:ReleaseDeliveryPolicy};getReleaseDeliveryPolicy:{policyHash:string;policy:ReleaseDeliveryPolicy};
 beginReleaseDelivery:ReleaseDelivery;getReleaseDelivery:ReleaseDelivery;
 getReleaseDeliveryOrigin:{job:PipelineInput<'recordPipelineStage'>['job'];policy:ReleaseDeliveryPolicy};
 listReleaseDeliveryMaterials:ReleaseDeliveryMaterial[];completeReleaseDelivery:ReleaseDelivery;
}
