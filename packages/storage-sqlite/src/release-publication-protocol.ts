import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {releasePromotionRequest} from './acceptance-commit-protocol.js';

const counter=z.number().int().nonnegative().safe(),generation=z.number().int().positive().safe();
const endpoint=z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)}),imageDigest=z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const releasePublicationGate=z.strictObject({datasetId:ids.dataset,datasetOperationId:ids.operation,datasetRequestHash:sha256,state:z.enum(['OPEN','CLOSED']),fence:counter,revision:counter,closeOperationId:ids.operation.nullable(),closeRequestHash:sha256.nullable()});
export const releasePublicationBasis=z.strictObject({sourceGate:releasePublicationGate.nullable(),targetGate:releasePublicationGate,previousRoute:z.strictObject({releaseId:ids.release,routeHash:sha256,generation}).nullable()});
const successor=z.strictObject({fenceId:opaqueKey,generation,proofHash:sha256,previousHoldHash:sha256});
export const releaseServiceClaim=z.strictObject({
 schemaVersion:z.literal('devmesh.release-service-claim.v1'),purpose:z.literal('RELEASE'),releaseId:ids.release,projectId:ids.project,runId:ids.run,candidateId:ids.candidate,
 acceptanceOperationId:ids.operation,preparationOperationId:ids.operation,promotionRequestHash:sha256,preparedProofHash:sha256,
 runnerId:opaqueKey,datasetId:ids.dataset,imageDigest,reservationId:opaqueKey,profileHash:sha256,serviceRequestHash:sha256,instanceId:opaqueKey,networkId:opaqueKey,
 accessMode:z.literal('READ_WRITE'),custodyState:z.literal('RELEASE_OWNED'),writeAdmission:z.literal('CONTROL_GATE_FENCED'),targetFence:successor,
});
export const releaseRouteBinding=z.strictObject({schemaVersion:z.literal('devmesh.release-route.v1'),routeId:opaqueKey,generation,projectId:ids.project,releaseId:ids.release,previousReleaseId:ids.release.nullable(),datasetId:ids.dataset,imageDigest,instanceId:opaqueKey,endpoint,serviceClaimHash:sha256,state:z.literal('BOUND')});
/** Stable original publication fact. Fresh observations are deliberately outside
 * this object so recovery never rewrites the original proof to extend health. */
export const releasePublicationProof=z.strictObject({
 schemaVersion:z.literal('devmesh.release-published.v1'),releaseId:ids.release,acceptanceOperationId:ids.operation,preparationOperationId:ids.operation,promotionRequestHash:sha256,preparedProofHash:sha256,
 controllerId:opaqueKey,runnerId:opaqueKey,backendRef:opaqueKey,gates:releasePublicationBasis,
 readonlyRetirement:z.strictObject({reservationId:opaqueKey,profileHash:sha256,serviceRequestHash:sha256,instanceId:opaqueKey,networkId:opaqueKey,containerAbsent:z.literal(true),networkAbsent:z.literal(true),verifiedAt:timestamp}),
 revocation:z.strictObject({barrierId:opaqueKey,generation,proofHash:sha256,state:z.literal('PERMANENTLY_REVOKED')}),
 target:successor.extend({datasetId:ids.dataset,owner:z.literal('RELEASE'),state:z.literal('ARMED'),writeState:z.literal('CONTROL_CLOSED')}),
 source:successor.extend({releaseId:ids.release,datasetId:ids.dataset,datasetOperationId:ids.operation,state:z.literal('RETIRED'),writeState:z.literal('CLOSED')}).nullable(),
 service:z.strictObject({claim:releaseServiceClaim,claimHash:sha256,endpoint}),route:releaseRouteBinding,routeHash:sha256,publishedAt:timestamp,
});
export const releasePublicationObservation=z.discriminatedUnion('state',[
 z.strictObject({state:z.literal('UNKNOWN'),errorCode:opaqueKey,checkedAt:timestamp}),
 z.strictObject({state:z.literal('PUBLISHED'),proof:releasePublicationProof,checkedAt:timestamp,
  current:z.strictObject({
   service:z.strictObject({instanceId:opaqueKey,datasetId:ids.dataset,imageDigest,profileHash:sha256,claimHash:sha256,endpoint,accessMode:z.literal('READ_WRITE'),custodyState:z.literal('RELEASE_OWNED'),writeAdmission:z.literal('CONTROL_GATE_FENCED'),state:z.literal('HEALTHY')}),
   route:z.strictObject({routeId:opaqueKey,routeHash:sha256,generation,instanceId:opaqueKey,state:z.literal('BOUND')}),
   fences:z.strictObject({targetProofHash:sha256,sourceProofHash:sha256.nullable(),revocationProofHash:sha256,targetState:z.literal('ARMED'),targetWriteState:z.literal('CONTROL_CLOSED'),sourceWriteState:z.literal('CLOSED')}),
  }),
 }),
]);
const bound={principalId:opaqueKey,releaseId:ids.release,requestHash:sha256};
export const releasePublicationRequests={
 getReleasePublication:z.strictObject({principalId:opaqueKey,releaseId:ids.release}),
 listReleasePublications:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256,afterSequence:counter.default(0),limit:z.number().int().min(1).max(100).default(20)}),
 listReleasePublicationWork:z.strictObject({principalId:opaqueKey,projectId:ids.project,policyHash:sha256,afterSequence:counter.default(0),limit:z.number().int().min(1).max(100).default(20)}),
 beginReleasePublication:z.strictObject({...bound,expectedRevision:counter}),
  verifyReleasePublication:z.strictObject(bound),
  verifyReleasePublicationContinuation:z.strictObject(bound),
 recordReleasePublicationObservation:z.strictObject({...bound,expectedRevision:counter,expectedSequence:counter,observation:releasePublicationObservation}),
 listReleasePublicationHistory:z.strictObject({...bound,afterSequence:counter.default(0),limit:z.number().int().min(1).max(100).default(20)}),
};
export type ReleasePublicationObservation=z.output<typeof releasePublicationObservation>;
export type ReleasePublicationProof=z.output<typeof releasePublicationProof>;
export interface ReleasePublication {
 releaseId:string;projectId:string;runId:string;requestHash:string;request:z.output<typeof releasePromotionRequest>;
 state:'PENDING'|'SENT'|'UNKNOWN'|'PUBLISHED';revision:number;sequence:number;errorCode:string|null;
 basis:z.output<typeof releasePublicationBasis>|null;proof:ReleasePublicationProof|null;proofHash:string|null;
 acceptedAt:string;dispatchedAt:string|null;updatedAt:string;publishedAt:string|null;isCurrentAccepted:boolean;
}
export type ReleasePublicationMethod=keyof typeof releasePublicationRequests;
export type ReleasePublicationInput<M extends ReleasePublicationMethod>=z.output<(typeof releasePublicationRequests)[M]>;
export interface ReleasePublicationResults {
 getReleasePublication:ReleasePublication;
 listReleasePublications:{items:{sequence:number;publication:ReleasePublication}[];nextSequence:number|null};
 listReleasePublicationWork:{items:{sequence:number;publication:ReleasePublication}[];nextSequence:number|null};
 beginReleasePublication:{dispatch:boolean;publication:ReleasePublication};
  verifyReleasePublication:{allowed:boolean;reasonCode:string|null};
  verifyReleasePublicationContinuation:{allowed:boolean;reasonCode:string|null};
 recordReleasePublicationObservation:ReleasePublication;
 listReleasePublicationHistory:{items:{sequence:number;revision:number;state:ReleasePublication['state'];errorCode:string|null;observedAt:string}[];nextSequence:number|null};
}
export interface ReleasePublicationBackend {
 readonly configured:boolean;
 /** Check exact configured physical capabilities only; never publish or acquire. */
 preflight(publication:ReleasePublication):Promise<void>;
 /** Only the unique durable grant winner may call this. The trusted adapter must
  * durably identify every original stage, permanently revoke old preparation,
  * retire the exact readonly service and install a distinct, physically fenced
  * writable service/route. No data initialization or migration belongs here. */
 publish(publication:ReleasePublication,authorize:()=>Promise<boolean>):Promise<ReleasePublicationObservation>;
 /** Query the original result and current objects; never acquire, renew, create,
  * migrate, start a replacement, switch routes or open a gate in this method. */
  inspect(publication:ReleasePublication):Promise<ReleasePublicationObservation>;
  /** Explicit original-stage coordination. Each unstarted physical stage needs a
   * new unique durable Runner grant. Uncertain dispatched stages are query-only. */
  resume?(publication:ReleasePublication,authorize:()=>Promise<boolean>):Promise<ReleasePublicationObservation>;
}
