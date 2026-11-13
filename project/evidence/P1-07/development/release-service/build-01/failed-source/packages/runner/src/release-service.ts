import {createHash} from 'node:crypto';
import {z} from 'zod';
import {ids,opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {canonical,releaseServiceClaim,releaseRouteBinding,releasePublicationProof} from '@devmesh/storage-sqlite';
import type {ReleasePublication,ReleasePublicationProof} from '@devmesh/storage-sqlite';
import {releaseRetirementRequest} from './release-retirement.js';
import type {ReleaseRetirement} from './release-retirement.js';
import {previewContainerProfile,dockerObjectId} from './preview-container.js';
import {previewResourceLimits,runnerCapacity} from './preview-reservation.js';
import type {ServiceContainerFact} from './service-docker.js';

export const releaseServiceRequest=releaseRetirementRequest.extend({schemaVersion:z.literal('devmesh.release-service-start.v1'),purpose:z.literal('RELEASE'),retirementRequestHash:sha256});
export const releaseServiceFences=z.strictObject({schemaVersion:z.literal('devmesh.release-service-fences.v1'),releaseId:ids.release,promotionRequestHash:sha256,retirementRequestHash:sha256,revocationProofHash:sha256,target:releasePublicationProof.shape.target,source:releasePublicationProof.shape.source});
export const releaseServiceProfile=previewContainerProfile.omit({schemaVersion:true}).extend({schemaVersion:z.literal('devmesh.release-service-profile.v1'),purpose:z.literal('RELEASE'),accessMode:z.literal('READ_WRITE'),writeAdmission:z.literal('CONTROL_GATE_FENCED'),fenceProofHash:sha256,gateBindingHash:sha256});
export const releaseServiceGuardProof=z.strictObject({schemaVersion:z.literal('devmesh.release-service-guard.v1'),releaseId:ids.release,runnerId:opaqueKey,controllerId:opaqueKey,serviceRequestHash:sha256,reservationId:opaqueKey,profileHash:sha256,datasetId:ids.dataset,targetProofHash:sha256,gateBindingHash:sha256,guardId:opaqueKey,proofHash:sha256,scope:z.literal('ALL_DATASET_WRITES'),writeAdmission:z.literal('CONTROL_GATE_FENCED'),state:z.literal('ENFORCED')});
export const releaseServiceKind=z.enum(['ARM_FENCES','SOURCE_STOP','SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE','GUARD_ENFORCE','NETWORK_CREATE','CREATE','START','ROUTE_BIND']);
export const releaseServiceActionRequest=z.strictObject({schemaVersion:z.literal('devmesh.release-service-action.v1'),operationId:ids.operation,releaseId:ids.release,serviceRequestHash:sha256,kind:releaseServiceKind,reservationId:opaqueKey.nullable(),profileHash:sha256.nullable(),containerId:dockerObjectId.nullable(),networkId:dockerObjectId.nullable()});
export const releaseServiceObservation=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('ARM_FENCES'),proof:releaseServiceFences,checkedAt:timestamp}),
 z.strictObject({kind:z.literal('GUARD_ENFORCE'),proof:releaseServiceGuardProof,checkedAt:timestamp}),
 z.strictObject({kind:z.enum(['NETWORK_CREATE','CREATE','START','SOURCE_STOP']),objectId:dockerObjectId,state:z.enum(['CREATED','RUNNING','EXITED']),checkedAt:timestamp}),
 z.strictObject({kind:z.enum(['SOURCE_CONTAINER_REMOVE','SOURCE_NETWORK_REMOVE']),objectId:dockerObjectId,absenceVerified:z.literal(true),checkedAt:timestamp}),
 z.strictObject({kind:z.literal('ROUTE_BIND'),route:releaseRouteBinding,routeHash:sha256,checkedAt:timestamp}),
]);
export const releaseServiceAction=z.strictObject({request:releaseServiceActionRequest,requestHash:sha256,state:z.enum(['SENT','OBSERVED']),observation:releaseServiceObservation.nullable(),createdAt:timestamp,observedAt:timestamp.nullable()});
const endpoint=z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)});
export const releaseServiceFact=z.strictObject({releaseId:ids.release,datasetId:ids.dataset,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),state:z.enum(['CREATED','HEALTHY','UNHEALTHY','UNKNOWN','EXITED']),instanceId:dockerObjectId.nullable(),endpoint:endpoint.nullable(),checkedAt:timestamp}).superRefine((f,c)=>{if(f.state!=='UNKNOWN'&&f.instanceId===null||['HEALTHY','UNHEALTHY'].includes(f.state)&&f.endpoint===null)c.addIssue({code:'custom',message:'Exact original instance and endpoint required'});});
export const releaseServiceReservation=z.strictObject({purpose:z.literal('RELEASE'),releaseId:ids.release,reservationId:opaqueKey,controllerId:opaqueKey,requestHash:sha256,resourceLimits:previewResourceLimits,state:z.enum(['RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','REMOVED']),revision:z.number().int().nonnegative().safe(),instanceId:dockerObjectId.nullable(),endpoint:endpoint.nullable(),fact:releaseServiceFact.nullable(),claim:releaseServiceClaim.nullable(),claimHash:sha256.nullable(),createdAt:timestamp,updatedAt:timestamp,releasedAt:timestamp.nullable()});
export type ReleaseServiceRequest=z.output<typeof releaseServiceRequest>;
export type ReleaseServiceProfile=z.output<typeof releaseServiceProfile>;
export type ReleaseServiceFences=z.output<typeof releaseServiceFences>;
export type ReleaseServiceGuardProof=z.output<typeof releaseServiceGuardProof>;
export type ReleaseServiceKind=z.output<typeof releaseServiceKind>;
export type ReleaseServiceAction=z.output<typeof releaseServiceAction>;
export type ReleaseServiceReservation=z.output<typeof releaseServiceReservation>;
export interface ReleaseServiceOriginal {request:ReleaseServiceRequest;requestHash:string;reservation:ReleaseServiceReservation;profile:ReleaseServiceProfile;profileHash:string;networkId:string;containerId:string;proof:ReleasePublicationProof}
export interface ReleaseServiceJournal {sequence:number;controllerId:string;request:ReleaseServiceRequest;requestHash:string;retirement:ReleaseRetirement;source:ReleaseServiceOriginal|null;reservation:ReleaseServiceReservation|null;profile:ReleaseServiceProfile|null;profileHash:string|null;networkId:string|null;containerId:string|null;actions:ReleaseServiceAction[];proof:ReleasePublicationProof|null;proofHash:string|null;createdAt:string}
const bound={controllerId:opaqueKey,releaseId:ids.release,requestHash:sha256};
export const releaseServiceStoreRequests={
 releaseServiceEnroll:z.strictObject({controllerId:opaqueKey,request:releaseServiceRequest,requestHash:sha256,resourceLimits:previewResourceLimits}),
 releaseServiceGet:z.strictObject(bound),
 releaseServicePage:z.strictObject({controllerId:opaqueKey,afterSequence:z.number().int().nonnegative().safe().default(0),limit:z.number().int().min(1).max(100).default(20)}),
 releaseServiceReserve:z.strictObject({...bound,capacity:runnerCapacity}),
 releaseServiceProfilePrepare:z.strictObject({...bound,profile:releaseServiceProfile}),
 releaseServiceActionBegin:z.strictObject({...bound,kind:releaseServiceKind}),
 releaseServiceActionAuthorized:z.strictObject({...bound,kind:releaseServiceKind,actionRequestHash:sha256}),
 releaseServiceActionObserve:z.strictObject({...bound,kind:releaseServiceKind,actionRequestHash:sha256,observation:releaseServiceObservation}),
 releaseServiceRecord:z.strictObject({...bound,expectedRevision:z.number().int().nonnegative().safe(),fact:releaseServiceFact}),
 releaseServiceOwn:z.strictObject(bound),releaseServicePrepareProof:z.strictObject(bound),
};
export interface ReleaseServiceStoreResults {
 releaseServiceEnroll:{dispatch:boolean;journal:ReleaseServiceJournal};releaseServiceGet:ReleaseServiceJournal;
 releaseServicePage:{items:ReleaseServiceJournal[];nextSequence:number|null};
 releaseServiceReserve:ReleaseServiceJournal;releaseServiceProfilePrepare:ReleaseServiceJournal;
 releaseServiceActionBegin:{dispatch:boolean;action:ReleaseServiceAction};releaseServiceActionAuthorized:{allowed:boolean};releaseServiceActionObserve:ReleaseServiceJournal;
 releaseServiceRecord:ReleaseServiceJournal;releaseServiceOwn:ReleaseServiceJournal;releaseServicePrepareProof:ReleaseServiceJournal;
}
export function releaseServiceNames(id:string){opaqueKey.parse(id);const key=createHash('sha256').update(id).digest('hex').slice(0,32);return {networkName:'devmesh-rn-'+key,containerName:'devmesh-rc-'+key};}
export function releaseServiceGateBinding(r:ReleaseServiceRequest){return createHash('sha256').update(canonical({releaseId:r.promotion.preparation.releaseId,promotionRequestHash:r.promotionRequestHash,gate:r.gates.targetGate})).digest('hex');}
/** Owns physical handoff of the exact old HELD generations. ARM_FENCES must keep
 * all target writes closed, retire the old source, and preserve permanent revoke. */
export interface ReleaseServiceAuthority {
 readonly configured:boolean;preflight(p:ReleasePublication):Promise<void>;
 handoff(retirement:ReleaseRetirement,authorize:()=>Promise<boolean>):Promise<ReleaseServiceFences>;
 inspect(retirement:ReleaseRetirement):Promise<ReleaseServiceFences|null>;
}
/** Enforce before mounting/starting any writable instance. Every dataset write,
 * including background/direct filesystem writes, must obey the exact physical
 * generation AND current control gate. A proxy flag alone does not satisfy this. */
export interface ReleaseServiceWriteGuard {
 readonly configured:boolean;
 enforce(p:ReleaseServiceProfile,r:ReleaseServiceRequest,controllerId:string,authorize:()=>Promise<boolean>):Promise<ReleaseServiceGuardProof>;
 inspect(p:ReleaseServiceProfile,r:ReleaseServiceRequest,controllerId:string):Promise<ReleaseServiceGuardProof|null>;
}
export interface ReleaseServiceDriver {
 readonly configured:boolean;probe(r:ReleaseServiceRequest['promotion']['preparation'],repository:string):Promise<void>;
 prepare(p:ReleaseServiceProfile,r:ReleaseServiceRequest):Promise<void>;
 enforceGuard(p:ReleaseServiceProfile,r:ReleaseServiceRequest,controllerId:string,authorize:()=>Promise<boolean>):Promise<ReleaseServiceGuardProof>;
 inspectGuard(p:ReleaseServiceProfile,r:ReleaseServiceRequest,controllerId:string):Promise<ReleaseServiceGuardProof|null>;
 network(p:ReleaseServiceProfile,r:ReleaseServiceRequest):Promise<string|null>;
 createNetwork(p:ReleaseServiceProfile,r:ReleaseServiceRequest,authorize:()=>Promise<boolean>):Promise<string>;
 inspect(p:ReleaseServiceProfile,r:ReleaseServiceRequest,networkId:string,containerId:string|null):Promise<ServiceContainerFact|null>;
 create(p:ReleaseServiceProfile,r:ReleaseServiceRequest,networkId:string,authorize:()=>Promise<boolean>):Promise<ServiceContainerFact|null>;
 start(p:ReleaseServiceProfile,r:ReleaseServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<ServiceContainerFact|null>;
 stop(p:ReleaseServiceProfile,r:ReleaseServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<ServiceContainerFact|null>;
 removeContainer(p:ReleaseServiceProfile,r:ReleaseServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<void>;
 removeNetwork(p:ReleaseServiceProfile,r:ReleaseServiceRequest,networkId:string,authorize:()=>Promise<boolean>):Promise<void>;
 containerAbsent(id:string):Promise<boolean>;networkAbsent(id:string):Promise<boolean>;
}
/** Bind the exact original route under control admission; never expose an
 * unguarded service or activate an unrelated generation. inspect is query-only. */
export interface ReleaseServiceRoutes {
 readonly configured:boolean;preflight(p:ReleasePublication):Promise<void>;
 bind(j:ReleaseServiceJournal,authorize:()=>Promise<boolean>):Promise<z.output<typeof releaseRouteBinding>>;
 inspect(j:ReleaseServiceJournal):Promise<z.output<typeof releaseRouteBinding>|null>;
}
