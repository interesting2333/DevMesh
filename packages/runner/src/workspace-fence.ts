import {z} from 'zod';
import {executionPermit,ids,opaqueKey,relativeFile,sha256,timestamp} from '@devmesh/contracts';

export const workspaceBindingSchema=z.strictObject({attemptId:opaqueKey,ownerKind:z.enum(['workflowAttempt','invocationAttempt']),resourceId:opaqueKey,relativePath:relativeFile,sourceDirectory:z.literal('repo').optional()});
export type WorkspaceBinding=z.output<typeof workspaceBindingSchema>;
export const acquireWorkspaceFence=z.strictObject({operationId:ids.operation,parentOperationId:ids.operation,workspaceRef:opaqueKey,permit:executionPermit,holderToken:z.uuid()});
export type AcquireWorkspaceFence=z.output<typeof acquireWorkspaceFence>;
export const releaseWorkspaceFence=z.strictObject({holderToken:z.uuid(),requestHash:sha256});
export const workspaceFenceSchema=z.strictObject({fenceId:opaqueKey,controllerId:opaqueKey,operationId:ids.operation,workspaceRef:opaqueKey,workspacePath:z.string().min(1),holderToken:z.uuid(),requestHash:sha256,request:acquireWorkspaceFence,state:z.enum(['ACTIVE','RELEASED']),createdAt:timestamp,releasedAt:timestamp.nullable()});
export type WorkspaceFence=z.output<typeof workspaceFenceSchema>;
