import {z} from 'zod';
import {opaqueKey,sha256,timestamp,ids} from '@devmesh/contracts';
import {acceptanceAbortDecision} from '@devmesh/storage-sqlite';
import type {AcceptanceAbortRecord} from '@devmesh/storage-sqlite';
import {dockerObjectId} from './preview-container.js';
import type {AcceptanceServiceReservation,AcceptanceServiceProfile,AcceptanceServiceRequest,AcceptanceServiceDriver} from './acceptance-service.js';
import type {ServiceContainerFact} from './service-docker.js';

export const acceptanceAbortKind=z.enum(['STOP','CONTAINER_REMOVE','NETWORK_REMOVE']);
export const acceptanceAbortActionRequest=z.strictObject({schemaVersion:z.literal('devmesh.acceptance-service-abort-action.v1'),operationId:ids.operation,preparationOperationId:ids.operation,abortOperationId:ids.operation,decisionHash:sha256,reservationId:opaqueKey,serviceRequestHash:sha256,profileHash:sha256,kind:acceptanceAbortKind,containerId:dockerObjectId.nullable(),networkId:dockerObjectId});
export const acceptanceAbortObservation=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('STOP'),objectId:dockerObjectId,state:z.enum(['CREATED','EXITED']),checkedAt:timestamp}),
 z.strictObject({kind:z.enum(['CONTAINER_REMOVE','NETWORK_REMOVE']),objectId:dockerObjectId,absenceVerified:z.literal(true),checkedAt:timestamp}),
]);
export const acceptanceAbortAction=z.strictObject({request:acceptanceAbortActionRequest,requestHash:sha256,state:z.enum(['SENT','OBSERVED']),observation:acceptanceAbortObservation.nullable(),createdAt:timestamp,observedAt:timestamp.nullable()});
const bound={controllerId:opaqueKey,operationId:ids.operation,decisionHash:sha256};
export const acceptanceAbortStoreRequests={
 acceptanceAbortEnroll:z.strictObject({controllerId:opaqueKey,decision:acceptanceAbortDecision,decisionHash:sha256}),
 acceptanceAbortGet:z.strictObject(bound),
 acceptanceAbortActionBegin:z.strictObject({...bound,kind:acceptanceAbortKind}),
 acceptanceAbortActionAuthorized:z.strictObject({...bound,kind:acceptanceAbortKind,actionRequestHash:sha256}),
 acceptanceAbortActionObserve:z.strictObject({...bound,kind:acceptanceAbortKind,actionRequestHash:sha256,observation:acceptanceAbortObservation}),
};
export type AcceptanceAbortKind=z.output<typeof acceptanceAbortKind>;
export type AcceptanceAbortAction=z.output<typeof acceptanceAbortAction>;
export interface AcceptanceServiceAbort {controllerId:string;record:AcceptanceAbortRecord;reservation:AcceptanceServiceReservation|null;actions:AcceptanceAbortAction[];serviceCleared:boolean;networkCleared:boolean}
export interface AcceptanceAbortStoreResults {
 acceptanceAbortEnroll:AcceptanceServiceAbort;acceptanceAbortGet:AcceptanceServiceAbort;
 acceptanceAbortActionBegin:{dispatch:boolean;action:AcceptanceAbortAction};acceptanceAbortActionAuthorized:{allowed:boolean};acceptanceAbortActionObserve:AcceptanceServiceAbort;
}
export interface AcceptanceAbortDriver extends Pick<AcceptanceServiceDriver,'configured'|'network'|'inspect'> {
 stop(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<ServiceContainerFact|null>;
 containerAbsent(id:string):Promise<boolean>;networkAbsent(id:string):Promise<boolean>;
 removeContainer(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<void>;
 removeNetwork(p:AcceptanceServiceProfile,r:AcceptanceServiceRequest,networkId:string,authorize:()=>Promise<boolean>):Promise<void>;
}
