import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ids,opaqueKey,sha256} from '@devmesh/contracts';
import {canonical} from './json.js';
import {StorageError} from './errors.js';
import {previewAccessHttpRequest,previewAccessObservation} from './preview-access-protocol.js';
import type {PreviewWriteGate} from './preview-access-protocol.js';
import type {ReleasePublication} from './release-publication-protocol.js';

const counter=z.number().int().nonnegative().safe();
const gateway={principalId:opaqueKey,gatewayId:opaqueKey,configurationHash:sha256};
const subject={subjectPrincipalId:opaqueKey,runId:ids.run,releaseId:ids.release};
const original={...gateway,accessRequestId:opaqueKey,requestHash:sha256};
export const releaseAccessPolicy=z.strictObject({schemaVersion:z.literal('devmesh.release-access-policy.v1'),gatewayId:opaqueKey,gatewayPrincipalId:opaqueKey,configurationHash:sha256});
export const releaseAccessHttpRequest=previewAccessHttpRequest.safeExtend({headersSha256:sha256});
export const releaseAccessObservation=previewAccessObservation;
export const releaseAccessTarget=z.strictObject({
 schemaVersion:z.literal('devmesh.release-access-target.v1'),purpose:z.literal('RELEASE'),
 projectId:ids.project,runId:ids.run,releaseId:ids.release,candidateId:ids.candidate,manifestHash:sha256,policyHash:sha256,
 datasetId:ids.dataset,datasetOperationId:ids.operation,datasetRequestHash:sha256,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),
 runnerId:opaqueKey,controllerId:opaqueKey,backendRef:opaqueKey,promotionRequestHash:sha256,preparedProofHash:sha256,publicationProofHash:sha256,
 reservationId:opaqueKey,profileHash:sha256,serviceRequestHash:sha256,claimHash:sha256,instanceId:opaqueKey,networkId:opaqueKey,
 routeHash:sha256,routeGeneration:z.number().int().positive().safe(),endpoint:z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)}),
});
export type ReleaseAccessTarget=z.output<typeof releaseAccessTarget>;
export interface ReleaseAccessBinding {target:ReleaseAccessTarget;gate:PreviewWriteGate;canWrite:boolean}
export interface ReleaseAccessRecord {
 accessRequestId:string;gatewayId:string;configurationHash:string;subjectPrincipalId:string;
 target:ReleaseAccessTarget;request:z.output<typeof releaseAccessHttpRequest>;requestHash:string;gateFence:number;gateRevision:number;
 state:'PREPARED'|'DISPATCHED'|'UNKNOWN'|'FINISHED'|'NOT_SENT';revision:number;observation:z.output<typeof releaseAccessObservation>|null;
 createdAt:string;dispatchedAt:string|null;finishedAt:string|null;
}
const hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
/** A stable identity, never a statement of current physical health or admission. */
export function releaseTargetForPublication(p:ReleasePublication):ReleaseAccessTarget {
 const proof=p.proof,q=p.request.preparation;
 const deny=():never=>{throw new StorageError('RELEASE_ACCESS_RECOVERING',503,'Current accepted publication and its original writable identity are required');};
 if(p.state!=='PUBLISHED'||!p.isCurrentAccepted||!proof||p.proofHash!==hash(proof)||p.requestHash!==hash(p.request))return deny();
 const c=proof.service.claim,r=proof.route;
 if(hash(c)!==proof.service.claimHash||hash(r)!==proof.routeHash||proof.promotionRequestHash!==p.requestHash||proof.preparedProofHash!==p.request.proofHash||c.promotionRequestHash!==p.requestHash||c.preparedProofHash!==p.request.proofHash||proof.releaseId!==p.releaseId||q.releaseId!==p.releaseId||proof.acceptanceOperationId!==p.request.acceptanceOperationId||c.acceptanceOperationId!==proof.acceptanceOperationId||c.preparationOperationId!==q.operationId||proof.preparationOperationId!==q.operationId)return deny();
 for(const key of ['projectId','runId','releaseId','candidateId','runnerId'] as const)if(c[key]!==q[key])return deny();
 if(proof.runnerId!==q.runnerId||proof.backendRef!==q.backendRef||c.imageDigest!==q.image.imageDigest||c.datasetId!==q.target.datasetId||proof.target.datasetId!==c.datasetId||r.releaseId!==p.releaseId||r.projectId!==q.projectId||r.datasetId!==c.datasetId||r.imageDigest!==c.imageDigest||r.instanceId!==c.instanceId||r.serviceClaimHash!==proof.service.claimHash||canonical(r.endpoint)!==canonical(proof.service.endpoint)||canonical(c.targetFence)!==canonical(Object.fromEntries(['fenceId','generation','proofHash','previousHoldHash'].map(k=>[k,proof.target[k as keyof typeof proof.target]]))))return deny();
 return releaseAccessTarget.parse({schemaVersion:'devmesh.release-access-target.v1',purpose:'RELEASE',projectId:q.projectId,runId:q.runId,releaseId:p.releaseId,candidateId:q.candidateId,manifestHash:q.manifestHash,policyHash:q.policyHash,datasetId:c.datasetId,datasetOperationId:q.operationId,datasetRequestHash:p.request.preparedProof.requestHash,imageDigest:c.imageDigest,runnerId:c.runnerId,controllerId:proof.controllerId,backendRef:proof.backendRef,promotionRequestHash:p.requestHash,preparedProofHash:p.request.proofHash,publicationProofHash:p.proofHash,reservationId:c.reservationId,profileHash:c.profileHash,serviceRequestHash:c.serviceRequestHash,claimHash:proof.service.claimHash,instanceId:c.instanceId,networkId:c.networkId,routeHash:proof.routeHash,routeGeneration:r.generation,endpoint:proof.service.endpoint});
}
export function releaseAccessRequestHash(r:Pick<ReleaseAccessRecord,'target'|'request'|'gateFence'|'gateRevision'|'subjectPrincipalId'|'gatewayId'|'configurationHash'>){return hash({purpose:'RELEASE',target:r.target,request:r.request,gateFence:r.gateFence,gateRevision:r.gateRevision,subjectPrincipalId:r.subjectPrincipalId,gatewayId:r.gatewayId,configurationHash:r.configurationHash});}
export const releaseAccessRequests={
 registerReleaseAccessPolicy:z.strictObject({principalId:opaqueKey,projectId:ids.project,policy:releaseAccessPolicy}),
 getReleaseWriteGate:z.strictObject({principalId:opaqueKey,releaseId:ids.release}),
 resolveReleaseAccess:z.strictObject({...gateway,...subject}),
 prepareReleaseAccessRequest:z.strictObject({...gateway,...subject,accessRequestId:opaqueKey,request:releaseAccessHttpRequest}),
 beginReleaseAccessRequest:z.strictObject(original),releaseAccessRequestAuthorized:z.strictObject(original),getReleaseAccessRequest:z.strictObject(original),
 recordReleaseAccessObservation:z.strictObject({...original,observation:releaseAccessObservation}),
 listReleaseAccessRequests:z.strictObject({...gateway,projectId:ids.project,afterSequence:counter.default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type ReleaseAccessMethod=keyof typeof releaseAccessRequests;
export type ReleaseAccessInput<M extends ReleaseAccessMethod>=z.output<(typeof releaseAccessRequests)[M]>;
export interface ReleaseAccessResults {
 registerReleaseAccessPolicy:{policy:z.output<typeof releaseAccessPolicy>};getReleaseWriteGate:PreviewWriteGate;resolveReleaseAccess:ReleaseAccessBinding;
 prepareReleaseAccessRequest:ReleaseAccessRecord;beginReleaseAccessRequest:{dispatch:boolean;record:ReleaseAccessRecord};releaseAccessRequestAuthorized:{allowed:boolean};getReleaseAccessRequest:ReleaseAccessRecord;recordReleaseAccessObservation:ReleaseAccessRecord;
 listReleaseAccessRequests:{items:{sequence:number;record:ReleaseAccessRecord}[];nextSequence:number|null};
}
