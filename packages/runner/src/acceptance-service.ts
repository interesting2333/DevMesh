import {createHash} from 'node:crypto';
import {z} from 'zod';
import {opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {acceptancePreparationRequest,acceptanceServiceClaim,canonical} from '@devmesh/storage-sqlite';
import {acceptanceDatasetReceipt,acceptanceDatasetFences} from './dataset-journal.js';
import {previewContainerProfile,dockerObjectId} from './preview-container.js';
import {previewResourceLimits,runnerCapacity} from './preview-reservation.js';
import type {ServiceContainerFact} from './service-docker.js';
import type {AcceptancePreparation} from '@devmesh/storage-sqlite';

export const acceptanceServiceRequest=z.strictObject({schemaVersion:z.literal('devmesh.acceptance-service-start.v1'),purpose:z.literal('ACCEPTANCE'),preparation:acceptancePreparationRequest,acceptanceRequestHash:sha256,dataReceipt:acceptanceDatasetReceipt,fences:acceptanceDatasetFences}).superRefine((s,c)=>{
 const r=s.preparation,d=s.dataReceipt,f=s.fences,hash=(v:unknown)=>createHash('sha256').update(canonical(v)).digest('hex');
 if(s.acceptanceRequestHash!==hash(r)||r.dataPlanHash!==hash(r.dataPlan)||d.operationId!==r.operationId||d.requestHash!==s.acceptanceRequestHash||f.operationId!==r.operationId||f.requestHash!==s.acceptanceRequestHash||d.fencesHash!==createHash('sha256').update(canonical(f)+'\n').digest('hex')||d.data.datasetId!==r.target.datasetId||d.data.storageKey!==r.target.storageKey||d.data.schemaRevision!==r.target.schemaRevision||d.data.sourceReleaseId!==r.expectedAcceptedReleaseId||d.data.originDatasetId!==(r.dataPlan.strategy==='PRESERVE_MIGRATE'?r.source?.datasetId??null:null)||canonical(d.data.migrationRef)!==canonical(r.dataPlan.migrationRef)||f.targetFence.datasetId!==r.target.datasetId||(r.source?f.sourceFence?.datasetId!==r.source.datasetId||f.sourceFence.datasetOperationId!==r.source.datasetOperationId||f.sourceFence.closeOperationId!==r.operationId:f.sourceFence!==null))c.addIssue({code:'custom',message:'Original acceptance request, materialized data and exact custody required'});
});
export const acceptanceServiceProfile=previewContainerProfile.omit({schemaVersion:true}).extend({schemaVersion:z.literal('devmesh.acceptance-service-profile.v1'),purpose:z.literal('ACCEPTANCE'),accessMode:z.literal('READ_ONLY')});
export const acceptanceServiceFact=z.strictObject({operationId:opaqueKey,releaseId:opaqueKey,datasetId:opaqueKey,imageDigest:z.string().regex(/^sha256:[a-f0-9]{64}$/),state:z.enum(['CREATED','HEALTHY','UNHEALTHY','UNKNOWN','EXITED']),instanceId:dockerObjectId.nullable(),endpoint:z.strictObject({host:z.literal('127.0.0.1'),port:z.number().int().min(1024).max(65535)}).nullable(),checkedAt:timestamp}).superRefine((f,c)=>{if(f.state!=='UNKNOWN'&&f.instanceId===null||['HEALTHY','UNHEALTHY'].includes(f.state)&&f.endpoint===null)c.addIssue({code:'custom',message:'Exact original instance and endpoint required'});});
export const acceptanceServiceReservation=z.strictObject({purpose:z.literal('ACCEPTANCE'),reservationId:opaqueKey,controllerId:opaqueKey,request:acceptanceServiceRequest,requestHash:sha256,resourceLimits:previewResourceLimits,state:z.enum(['RESERVED','DISPATCHED','ACTIVE','UNKNOWN','EXITED','CANCELLED']),revision:z.number().int().nonnegative().safe(),instanceId:dockerObjectId.nullable(),endpoint:acceptanceServiceFact.shape.endpoint,fact:acceptanceServiceFact.nullable(),custodyState:z.enum(['PREPARING','RELEASE_HELD']),claim:acceptanceServiceClaim.nullable(),claimHash:sha256.nullable(),createdAt:timestamp,updatedAt:timestamp,releasedAt:timestamp.nullable()});
export const reserveAcceptanceService=z.strictObject({request:acceptanceServiceRequest,requestHash:sha256,resourceLimits:previewResourceLimits,capacity:runnerCapacity});
export const acceptanceServiceActionKind=z.enum(['NETWORK_CREATE','CREATE','START']);
export const acceptanceServiceActionObservation=z.strictObject({objectId:dockerObjectId,state:z.enum(['CREATED','RUNNING','EXITED']),checkedAt:timestamp});
export const acceptanceServiceActionRequest=z.strictObject({schemaVersion:z.literal('devmesh.acceptance-service-action.v1'),purpose:z.literal('ACCEPTANCE'),operationId:opaqueKey,reservationId:opaqueKey,serviceRequestHash:sha256,profileHash:sha256,kind:acceptanceServiceActionKind,networkId:dockerObjectId.nullable(),containerId:dockerObjectId.nullable()});
export const acceptanceServiceActionRecord=z.strictObject({request:acceptanceServiceActionRequest,requestHash:sha256,state:z.enum(['SENT','OBSERVED']),observation:acceptanceServiceActionObservation.nullable(),createdAt:timestamp,observedAt:timestamp.nullable()});
export type AcceptanceServiceRequest=z.output<typeof acceptanceServiceRequest>;
export type AcceptanceServiceProfile=z.output<typeof acceptanceServiceProfile>;
export type AcceptanceServiceFact=z.output<typeof acceptanceServiceFact>;
export type AcceptanceServiceReservation=z.output<typeof acceptanceServiceReservation>;
export type AcceptanceServiceAction=z.output<typeof acceptanceServiceActionRecord>;
export interface AcceptanceServiceJournal {profile:AcceptanceServiceProfile;profileHash:string;networkId:string|null;containerId:string|null;actions:AcceptanceServiceAction[]}
export interface AcceptanceServiceDriver {
 readonly configured:boolean;
 probe(request:AcceptancePreparation['request'],repository:string):Promise<void>;
 prepare(profile:AcceptanceServiceProfile):Promise<void>;
 network(profile:AcceptanceServiceProfile,request:AcceptanceServiceRequest):Promise<string|null>;
 createNetwork(profile:AcceptanceServiceProfile,request:AcceptanceServiceRequest,authorize:()=>Promise<boolean>):Promise<string>;
 inspect(profile:AcceptanceServiceProfile,request:AcceptanceServiceRequest,networkId:string,containerId:string|null):Promise<ServiceContainerFact|null>;
 create(profile:AcceptanceServiceProfile,request:AcceptanceServiceRequest,networkId:string,authorize:()=>Promise<boolean>):Promise<ServiceContainerFact|null>;
 start(profile:AcceptanceServiceProfile,request:AcceptanceServiceRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<ServiceContainerFact|null>;
}
export function acceptanceServiceNames(reservationId:string){opaqueKey.parse(reservationId);const key=createHash('sha256').update(reservationId).digest('hex').slice(0,32);return {networkName:'devmesh-an-'+key,containerName:'devmesh-ac-'+key};}
