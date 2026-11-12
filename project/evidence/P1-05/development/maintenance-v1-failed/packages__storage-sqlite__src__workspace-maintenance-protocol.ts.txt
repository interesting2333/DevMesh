import {z} from 'zod';
import {executionPermit,ids,opaqueKey} from '@devmesh/contracts';
export const workspaceMaintenanceRequests={authorizeWorkspaceMaintenance:z.strictObject({permit:executionPermit,operationId:ids.operation,workspaceRef:opaqueKey,runnerId:opaqueKey}),authorizeManagedWorkspaceAccess:z.strictObject({permit:executionPermit,workspaceRef:opaqueKey,runnerId:opaqueKey,purpose:z.enum(['execution','fence'])})};
export type WorkspaceMaintenanceMethod=keyof typeof workspaceMaintenanceRequests;
export type WorkspaceMaintenanceInput=z.output<typeof workspaceMaintenanceRequests.authorizeWorkspaceMaintenance>;
export interface WorkspaceMaintenanceAuthority {operationId:string;operationKind:'allocation'|'repoGit'|'repoFile'|'sourceArchive'|'preservation'|'reclamation';workspaceRef:string;allocationOperationId:string;projectId:string;runnerId:string;attemptId:string;activationId:string;grantId:string}
export interface WorkspaceMaintenanceResults {authorizeWorkspaceMaintenance:WorkspaceMaintenanceAuthority;authorizeManagedWorkspaceAccess:import('./workspace-protocol.js').WorkspaceAllocation}
