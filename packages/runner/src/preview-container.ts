import {z} from 'zod';
import {createHash} from 'node:crypto';
import {isAbsolute} from 'node:path';
import {opaqueKey,sha256,timestamp} from '@devmesh/contracts';
import {previewStartRequest,previewStopRequest} from '@devmesh/storage-sqlite';
import type {PreviewStartRequest} from '@devmesh/storage-sqlite';
import {previewResourceLimits} from './preview-reservation.js';

export const dockerObjectId=z.string().regex(/^[a-f0-9]{64}$/);
export const previewRepository=z.string().max(256).regex(/^[a-z0-9][a-z0-9._:/-]*$/).refine(v=>!v.includes('..')&&!v.endsWith('/')&&!v.endsWith(':'));
const hostPath=z.string().min(1).max(2048).refine(v=>isAbsolute(v)&&!/[\0\r\n,]/.test(v));
export const previewContainerProfile=z.strictObject({schemaVersion:z.literal('devmesh.preview-container-profile.v1'),reservationId:opaqueKey,requestHash:sha256,repository:previewRepository,datasetDirectory:hostPath,datasetBytes:z.number().int().min(4096).max(256*1024*1024),resourceLimits:previewResourceLimits,networkName:opaqueKey,containerName:opaqueKey});
export const previewContainerAction=z.enum(['NETWORK_CREATE','CREATE','START','STOP']);
export const previewContainerActionRequest=z.strictObject({kind:previewContainerAction,requestHash:sha256,request:z.union([previewStartRequest,previewStopRequest])});
export const previewContainerObservation=z.strictObject({objectId:dockerObjectId,state:z.enum(['CREATED','RUNNING','EXITED']),checkedAt:timestamp});
export const previewContainerActionSchema=z.strictObject({kind:previewContainerAction,operationId:opaqueKey,requestHash:sha256,request:z.union([previewStartRequest,previewStopRequest]),state:z.enum(['SENT','OBSERVED']),observation:previewContainerObservation.nullable(),createdAt:timestamp,observedAt:timestamp.nullable()});
export type PreviewContainerProfile=z.output<typeof previewContainerProfile>;
export type PreviewContainerAction=z.output<typeof previewContainerAction>;
export type PreviewContainerObservation=z.output<typeof previewContainerObservation>;
export type PreviewContainerActionRecord=z.output<typeof previewContainerActionSchema>;
export interface PreviewContainerJournal {profile:PreviewContainerProfile;profileHash:string;networkId:string|null;containerId:string|null;actions:PreviewContainerActionRecord[]}
export function previewContainerNames(reservationId:string){opaqueKey.parse(reservationId);const key=createHash('sha256').update(reservationId).digest('hex').slice(0,32);return {networkName:'devmesh-pn-'+key,containerName:'devmesh-pc-'+key};}
export interface PreviewContainerFact {containerId:string;networkId:string;state:'created'|'running'|'exited'|'unknown';pid:number;exitCode:number|null;endpoint:{host:'127.0.0.1';port:number}|null}
export interface PreviewContainerDriver {
 readonly configured:boolean;
 probe(request:PreviewStartRequest,repository:string):Promise<void>;
 prepare(profile:PreviewContainerProfile):Promise<void>;
 network(profile:PreviewContainerProfile,request:PreviewStartRequest):Promise<string|null>;
 createNetwork(profile:PreviewContainerProfile,request:PreviewStartRequest,authorize:()=>Promise<boolean>):Promise<string>;
 inspect(profile:PreviewContainerProfile,request:PreviewStartRequest,networkId:string,containerId:string|null):Promise<PreviewContainerFact|null>;
 create(profile:PreviewContainerProfile,request:PreviewStartRequest,networkId:string,authorize:()=>Promise<boolean>):Promise<PreviewContainerFact|null>;
 start(profile:PreviewContainerProfile,request:PreviewStartRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<PreviewContainerFact|null>;
 stop(profile:PreviewContainerProfile,request:PreviewStartRequest,networkId:string,containerId:string,authorize:()=>Promise<boolean>):Promise<PreviewContainerFact|null>;
}
