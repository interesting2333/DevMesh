import {z} from 'zod';
import {executionPermit,gitCommit,ids,opaqueKey,relativeFile,sha256} from '@devmesh/contracts';
const approvedDotFiles=new Set(['.gitignore','.node-version','.editorconfig','.gitattributes']);
export const managedSourcePath=relativeFile.refine(v=>v.split('/').every((p,i,parts)=>(!p.startsWith('.')||i===parts.length-1&&approvedDotFiles.has(p))&&!['node_modules','vendor','secrets'].includes(p.toLowerCase())&&Array.from(p).every(c=>c.charCodeAt(0)>=32&&c.charCodeAt(0)!==127)&&!/[. ]$/.test(p)&&!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))&&!/\.(pem|key|p12|pfx)$/i.test(v),'Expected an approved source path');
export const sourceManifest=z.strictObject({commit:gitCommit,tree:gitCommit,files:z.array(z.strictObject({path:managedSourcePath,mode:z.enum(['100644','100755']),objectId:gitCommit,byteSize:z.number().int().nonnegative().max(2*1024*1024),sha256})).max(2000),byteSize:z.number().int().nonnegative().max(8*1024*1024),sha256});
export const gitDirectoryIdentity=z.strictObject({root:z.string().min(1).max(2048),gitDirectory:z.string().min(1).max(2048),commonDirectory:z.string().min(1).max(2048),rootDevice:z.string().regex(/^\d+$/),rootFileId:z.string().regex(/^\d+$/),gitDevice:z.string().regex(/^\d+$/),gitFileId:z.string().regex(/^\d+$/)});
const allocation=z.strictObject({permit:executionPermit,operationId:ids.operation,workspaceRef:opaqueKey,repositoryResourceId:opaqueKey,runnerId:opaqueKey,kind:z.enum(['development','verification']),baseCommit:gitCommit});
export const workspaceRequests={
  beginManagedRepository:z.strictObject({principalId:opaqueKey,projectId:ids.project,operationId:ids.operation,resourceId:opaqueKey,templateCommit:gitCommit}),
  completeManagedRepository:z.strictObject({operationId:ids.operation,requestHash:sha256,identity:gitDirectoryIdentity,manifest:sourceManifest}),
  getManagedRepository:z.strictObject({principalId:opaqueKey,projectId:ids.project}),
  beginWorkspaceAllocation:allocation,
  getWorkspaceAllocation:z.strictObject({permit:executionPermit,operationId:ids.operation}),
  getAllocationRepository:z.strictObject({permit:executionPermit,operationId:ids.operation}),
  authorizeWorkspaceAllocation:z.strictObject({permit:executionPermit,operationId:ids.operation}),
  completeWorkspaceAllocation:z.strictObject({operationId:ids.operation,requestHash:sha256,identity:gitDirectoryIdentity,manifest:sourceManifest}),
  markWorkspaceAllocationUncertain:z.strictObject({operationId:ids.operation,requestHash:sha256,errorCode:opaqueKey}),
};
export type WorkspaceMethod=keyof typeof workspaceRequests;
export type WorkspaceInput<M extends WorkspaceMethod>=z.output<(typeof workspaceRequests)[M]>;
export type GitDirectoryIdentity=z.output<typeof gitDirectoryIdentity>;
export type SourceManifest=z.output<typeof sourceManifest>;
export interface ManagedRepository {projectId:string;resourceId:string;operationId:string;requestHash:string;templateCommit:string;state:string;identity:GitDirectoryIdentity|null;manifest:SourceManifest|null}
export interface WorkspaceAllocation {workspaceRef:string;operationId:string;projectId:string;runId:string;attemptId:string;activationId:string;grantId:string;runnerId:string;kind:'development'|'verification';baseCommit:string;scope:string[];requestHash:string;state:string;identity:GitDirectoryIdentity|null;manifest:SourceManifest|null;errorCode:string|null}
export interface WorkspaceResults {
  beginManagedRepository:ManagedRepository&{created:boolean};completeManagedRepository:ManagedRepository;getManagedRepository:ManagedRepository;
  beginWorkspaceAllocation:WorkspaceAllocation&{created:boolean};getWorkspaceAllocation:WorkspaceAllocation;completeWorkspaceAllocation:WorkspaceAllocation;markWorkspaceAllocationUncertain:WorkspaceAllocation;
  getAllocationRepository:ManagedRepository;
  authorizeWorkspaceAllocation:WorkspaceAllocation;
}
export const approvedWorkspaceScope=z.array(relativeFile).max(2000);
