import {z} from 'zod';
import {executionPermit,gitCommit,ids,opaqueKey,sha256} from '@devmesh/contracts';
import {gitDirectoryIdentity,sourceManifest} from './workspace-protocol.js';
import type {ManagedRepository,WorkspaceAllocation} from './workspace-protocol.js';
const decimal=z.string().regex(/^\d+$/).max(32);
export const workspaceMaterialIdentity=z.strictObject({device:decimal,fileId:decimal});
const path=z.string().min(1).max(1024),mode=z.number().int().min(0).max(0o777);
export const workspaceMaterialEntry=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('FILE'),path,identity:workspaceMaterialIdentity,mode,links:z.number().int().min(1).max(8000),mtimeNs:z.string().regex(/^-?\d+$/).max(32),ctimeNs:z.string().regex(/^-?\d+$/).max(32),byteSize:z.number().int().min(0).max(2*1024*1024),sha256}),
 z.strictObject({kind:z.literal('DIRECTORY'),path,identity:workspaceMaterialIdentity,mode}),
 z.strictObject({kind:z.literal('ABSENT'),path}),
 z.strictObject({kind:z.literal('EXCLUDED'),path,reason:z.enum(['retained-git-repository','rebuildable-node-modules']),identity:workspaceMaterialIdentity}),
]);
export const workspaceMaterialSnapshot=z.strictObject({schemaVersion:z.literal('devmesh.workspace-materials.v1'),root:z.string().min(1).max(4096),identity:workspaceMaterialIdentity,entries:z.array(workspaceMaterialEntry).max(8000),byteSize:z.number().int().min(0).max(128*1024*1024),sha256});
const retention=z.strictObject({ref:z.string().min(1).max(256),commit:gitCommit,manifest:sourceManifest});
export const workspacePreservationManifest=z.strictObject({schemaVersion:z.literal('devmesh.workspace-preservation.v1'),operationId:ids.operation,allocationOperationId:ids.operation,workspaceRef:opaqueKey,basisSha256:sha256,headCommit:gitCommit,repositoryIdentity:gitDirectoryIdentity,workspaceIdentity:gitDirectoryIdentity,parentMarkerSha256:sha256,retained:z.array(retention).min(1).max(65),snapshot:workspaceMaterialSnapshot});
export const workspacePreservationTarget={operationId:ids.operation,materialKey:z.string().regex(/^(manifest|[a-f0-9]{64})$/)};
const original={permit:executionPermit,operationId:ids.operation},bound={...original,requestHash:sha256};
const ack=z.strictObject({manifestSha256:sha256,snapshotSha256:sha256,materialCount:z.number().int().min(1).max(8001),repositoryIdentity:gitDirectoryIdentity,workspaceIdentity:gitDirectoryIdentity,parentIdentity:workspaceMaterialIdentity});
export const workspacePreservationRequests={
 getWorkspacePreservationInputs:z.strictObject({permit:executionPermit,allocationOperationId:ids.operation}),
 beginWorkspacePreservation:z.strictObject({...original,allocationOperationId:ids.operation}),
 getWorkspacePreservation:z.strictObject(original),
 prepareWorkspacePreservation:z.strictObject({...bound,manifest:workspacePreservationManifest}),
 listWorkspacePreservationMaterials:z.strictObject({...original,afterKey:z.string().default(''),limit:z.number().int().min(1).max(100).default(100)}),
 completeWorkspacePreservation:z.strictObject({...bound,acknowledgement:ack}),
 assertWorkspacePreservationReclaimable:z.strictObject({...original,manifestSha256:sha256}),
};
export type WorkspacePreservationMethod=keyof typeof workspacePreservationRequests;
export type WorkspacePreservationInput<M extends WorkspacePreservationMethod>=z.output<(typeof workspacePreservationRequests)[M]>;
export type WorkspacePreservationManifest=z.output<typeof workspacePreservationManifest>;
export interface WorkspacePreservationInputs {
 principalId:string;allocation:WorkspaceAllocation;repository:ManagedRepository;
 commits:{operationId:string;requestHash:string;commit:string;tree:string;ref:string;archive:{operationId:string;manifest:z.output<typeof sourceManifest>;acknowledgement:{archiveRef:string;sourceRef:string;commit:string;tree:string;manifestSha256:string;repositoryIdentity:z.output<typeof gitDirectoryIdentity>}}|null}[];
 fileOperations:{operationId:string;requestHash:string;state:string;cleanupConfirmed:boolean;proof:unknown;result:unknown}[];
}
export interface WorkspacePreservation {
 operationId:string;allocationOperationId:string;workspaceRef:string;principalId:string;requestHash:string;basisSha256:string;
 state:'SENT'|'PREPARED'|'ACKNOWLEDGED';basis:WorkspacePreservationInputs;manifest:WorkspacePreservationManifest|null;acknowledgement:z.output<typeof ack>|null;acknowledgedAt:string|null;
}
export interface WorkspacePreservationMaterial {operationId:string;materialKey:string;sha256:string;byteSize:number;writeKey:string;contentHash:string|null;writeId:string|null}
export interface WorkspacePreservationResults {
 getWorkspacePreservationInputs:WorkspacePreservationInputs;beginWorkspacePreservation:WorkspacePreservation&{created:boolean};getWorkspacePreservation:WorkspacePreservation;prepareWorkspacePreservation:WorkspacePreservation;
 listWorkspacePreservationMaterials:WorkspacePreservationMaterial[];completeWorkspacePreservation:WorkspacePreservation;assertWorkspacePreservationReclaimable:WorkspacePreservation;
}
