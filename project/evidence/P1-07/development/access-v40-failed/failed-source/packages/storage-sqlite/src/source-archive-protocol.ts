import {z} from 'zod';
import {executionPermit,gitCommit,ids,opaqueKey,sha256} from '@devmesh/contracts';
import {gitDirectoryIdentity,sourceManifest} from './workspace-protocol.js';
import type {ManagedRepository,SourceManifest,WorkspaceAllocation} from './workspace-protocol.js';
import type {RepoOperation} from './repo-protocol.js';
const original={permit:executionPermit,operationId:ids.operation};
const acknowledgement=z.strictObject({commit:gitCommit,tree:gitCommit,manifestSha256:sha256,repositoryIdentity:gitDirectoryIdentity,archiveRef:z.string().max(256),sourceRef:z.string().max(256)});
export const sourceArchiveRequests={
 beginSourceArchive:z.strictObject({...original,allocationOperationId:ids.operation,commitOperationId:ids.operation}),
 getSourceArchive:z.strictObject(original),
 prepareSourceArchive:z.strictObject({...original,requestHash:sha256,manifest:sourceManifest}),
 completeSourceArchive:z.strictObject({...original,requestHash:sha256,acknowledgement}),
 markSourceArchiveUncertain:z.strictObject({...original,requestHash:sha256,errorCode:opaqueKey}),
 failSourceArchive:z.strictObject({...original,requestHash:sha256,errorCode:opaqueKey}),
};
export type SourceArchiveMethod=keyof typeof sourceArchiveRequests;
export type SourceArchiveInput<M extends SourceArchiveMethod>=z.output<(typeof sourceArchiveRequests)[M]>;
export interface SourceArchive {
 operationId:string;allocationOperationId:string;commitOperationId:string;workspaceRef:string;requestHash:string;
 state:'SENT'|'PREPARED'|'ACKNOWLEDGED'|'FAILED';
 basis:{allocation:WorkspaceAllocation;repository:ManagedRepository;commitOperation:RepoOperation};
 manifest:SourceManifest|null;acknowledgement:z.output<typeof acknowledgement>|null;errorCode:string|null;acknowledgedAt:string|null;
}
export interface SourceArchiveResults {
 beginSourceArchive:SourceArchive&{created:boolean};getSourceArchive:SourceArchive;prepareSourceArchive:SourceArchive;completeSourceArchive:SourceArchive;markSourceArchiveUncertain:SourceArchive;failSourceArchive:SourceArchive;
}
