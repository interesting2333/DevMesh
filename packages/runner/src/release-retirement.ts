import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {releasePromotionRequest,releasePublicationBasis} from '@devmesh/storage-sqlite';
import type {AcceptanceServiceJournal,AcceptanceServiceReservation} from './acceptance-service.js';
import {dockerObjectId} from './preview-container.js';

/** Private trusted handoff, not a public caller-supplied cleanup permission. */
export const releaseRetirementRequest=z.strictObject({
 schemaVersion:z.literal('devmesh.release-retirement.v1'),promotion:releasePromotionRequest,
 promotionRequestHash:sha256,gates:releasePublicationBasis,
});
export const releaseRetirementKind=z.enum(['REVOKE_PREPARATION','STOP','CONTAINER_REMOVE','NETWORK_REMOVE']);
export const releaseRetirementRevocation=z.strictObject({
 schemaVersion:z.literal('devmesh.release-preparation-revoked.v1'),
 promotionRequestHash:sha256,preparationOperationId:ids.operation,releaseId:ids.release,
 runnerId:opaqueKey,controllerId:opaqueKey,barrierId:opaqueKey,generation:z.number().int().positive().safe(),
 proofHash:sha256,state:z.literal('PERMANENTLY_REVOKED'),
});
export const releaseRetirementActionRequest=z.strictObject({
 schemaVersion:z.literal('devmesh.release-retirement-action.v1'),operationId:ids.operation,
 releaseId:ids.release,promotionRequestHash:sha256,retirementRequestHash:sha256,
 reservationId:opaqueKey,serviceRequestHash:sha256,profileHash:sha256,
 networkId:dockerObjectId,containerId:dockerObjectId,kind:releaseRetirementKind,
});
export const releaseRetirementObservation=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('REVOKE_PREPARATION'),proof:releaseRetirementRevocation,checkedAt:timestamp}),
 z.strictObject({kind:z.literal('STOP'),objectId:dockerObjectId,state:z.enum(['CREATED','EXITED']),checkedAt:timestamp}),
 z.strictObject({kind:z.enum(['CONTAINER_REMOVE','NETWORK_REMOVE']),objectId:dockerObjectId,absenceVerified:z.literal(true),checkedAt:timestamp}),
]);
export const releaseRetirementAction=z.strictObject({request:releaseRetirementActionRequest,requestHash:sha256,state:z.enum(['SENT','OBSERVED']),observation:releaseRetirementObservation.nullable(),createdAt:timestamp,observedAt:timestamp.nullable()});
const bound={controllerId:opaqueKey,releaseId:ids.release,requestHash:sha256};
export const releaseRetirementStoreRequests={
 releaseRetirementEnroll:z.strictObject({controllerId:opaqueKey,request:releaseRetirementRequest,requestHash:sha256}),
 releaseRetirementGet:z.strictObject(bound),
 releaseRetirementPage:z.strictObject({controllerId:opaqueKey,afterSequence:z.number().int().nonnegative().safe().default(0),limit:z.number().int().min(1).max(100).default(20)}),
 releaseRetirementActionBegin:z.strictObject({...bound,kind:releaseRetirementKind}),
 releaseRetirementActionAuthorized:z.strictObject({...bound,kind:releaseRetirementKind,actionRequestHash:sha256}),
 releaseRetirementActionObserve:z.strictObject({...bound,kind:releaseRetirementKind,actionRequestHash:sha256,observation:releaseRetirementObservation}),
};
export type ReleaseRetirementRequest=z.output<typeof releaseRetirementRequest>;
export type ReleaseRetirementAction=z.output<typeof releaseRetirementAction>;
export type ReleaseRetirementKind=z.output<typeof releaseRetirementKind>;
export interface ReleaseRetirement {
 sequence:number;controllerId:string;request:ReleaseRetirementRequest;requestHash:string;
 reservation:AcceptanceServiceReservation;original:AcceptanceServiceJournal;
 actions:ReleaseRetirementAction[];revoked:boolean;containerCleared:boolean;networkCleared:boolean;createdAt:string;
}
export interface ReleaseRetirementStoreResults {
 releaseRetirementEnroll:{dispatch:boolean;journal:ReleaseRetirement};
 releaseRetirementGet:ReleaseRetirement;
 releaseRetirementPage:{items:ReleaseRetirement[];nextSequence:number|null};
 releaseRetirementActionBegin:{dispatch:boolean;action:ReleaseRetirementAction};
 releaseRetirementActionAuthorized:{allowed:boolean};releaseRetirementActionObserve:ReleaseRetirement;
}
/** Must permanently revoke all old preparation acquire/renew/write authority and
 * settle previously admitted actions. A file flag or logical gate is insufficient.
 * revoke must call authorize immediately before acting; inspect is query-only. */
export interface ReleaseRetirementAuthority {
 readonly configured:boolean;
 preflight(request:ReleaseRetirementRequest):Promise<void>;
 revoke(request:ReleaseRetirementRequest,controllerId:string,authorize:()=>Promise<boolean>):Promise<z.output<typeof releaseRetirementRevocation>>;
 inspect(request:ReleaseRetirementRequest,controllerId:string):Promise<z.output<typeof releaseRetirementRevocation>|null>;
}
