import {z} from 'zod';
import {executionPermit,ids,opaqueKey,sha256} from '@devmesh/contracts';
import {workspaceMaterialIdentity} from './workspace-preservation-protocol.js';
import type {WorkspacePreservation} from './workspace-preservation-protocol.js';
const original={permit:executionPermit,operationId:ids.operation},bound={...original,requestHash:sha256};
const isolationProof=z.strictObject({sourceAbsent:z.literal(true),trashIdentity:workspaceMaterialIdentity,manifestSha256:sha256,receiptSha256:sha256});
const deletionProof=z.strictObject({sourceAbsent:z.literal(true),trashAbsent:z.literal(true),receiptSha256:sha256});
export const workspaceReclamationRequests={
 beginWorkspaceReclamation:z.strictObject({...original,preservationOperationId:ids.operation}),
 getWorkspaceReclamation:z.strictObject(original),
 assertWorkspaceReclamationReady:z.strictObject(original),
 markWorkspaceIsolationSent:z.strictObject({...bound,receiptSha256:sha256}),
 acknowledgeWorkspaceIsolation:z.strictObject({...bound,proof:isolationProof}),
 markWorkspaceDeletionSent:z.strictObject({...bound,receiptSha256:sha256}),
 acknowledgeWorkspaceDeletion:z.strictObject({...bound,proof:deletionProof}),
 markWorkspaceReclamationUncertain:z.strictObject({...bound,errorCode:opaqueKey}),
};
export type WorkspaceReclamationMethod=keyof typeof workspaceReclamationRequests;
export type WorkspaceReclamationInput<M extends WorkspaceReclamationMethod>=z.output<(typeof workspaceReclamationRequests)[M]>;
export interface WorkspaceReclamation {
 operationId:string;preservationOperationId:string;workspaceRef:string;projectId:string;principalId:string;requestHash:string;createdAt:string;
 state:'PREPARED'|'ISOLATION_SENT'|'ISOLATED'|'DELETE_SENT'|'DELETED';
 basis:{preservation:WorkspacePreservation;sourcePath:string;trashPath:string};
 isolationIntentSha256:string|null;isolationProof:z.output<typeof isolationProof>|null;deleteIntentSha256:string|null;deletionProof:z.output<typeof deletionProof>|null;errorCode:string|null;
}
export interface WorkspaceReclamationResults {
 beginWorkspaceReclamation:WorkspaceReclamation&{created:boolean};getWorkspaceReclamation:WorkspaceReclamation;assertWorkspaceReclamationReady:WorkspaceReclamation;markWorkspaceIsolationSent:WorkspaceReclamation;acknowledgeWorkspaceIsolation:WorkspaceReclamation;
 markWorkspaceDeletionSent:WorkspaceReclamation;acknowledgeWorkspaceDeletion:WorkspaceReclamation;markWorkspaceReclamationUncertain:WorkspaceReclamation;
}
