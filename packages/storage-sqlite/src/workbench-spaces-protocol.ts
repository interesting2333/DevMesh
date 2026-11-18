import {z} from 'zod';
import {opaqueKey,ids,workbenchSpaceCreate,workbenchSpaceUpdate,workbenchSpaceDelete,workbenchSpaceMove,workbenchSpaceView,workbenchSpaceList,workbenchDirectoryBinding} from '@devmesh/contracts';
import type {OperationResult} from './protocol.js';
const selected={principalId:opaqueKey},meta=z.strictObject({...selected,scopeId:opaqueKey,idempotencyKey:z.uuid()});
export const workbenchSpaceRequests={
 listWorkbenchSpaces:z.strictObject(selected),
 getWorkbenchSpace:z.strictObject({...selected,spaceId:opaqueKey}),
 createWorkbenchSpace:z.strictObject({meta,body:workbenchSpaceCreate,binding:workbenchDirectoryBinding.nullable()}),
 updateWorkbenchSpace:z.strictObject({meta,spaceId:opaqueKey,body:workbenchSpaceUpdate,binding:workbenchDirectoryBinding.nullable()}),
 deleteWorkbenchSpace:z.strictObject({meta,spaceId:opaqueKey,body:workbenchSpaceDelete}),
 moveConversationSpace:z.strictObject({meta,conversationId:opaqueKey,body:workbenchSpaceMove}),
 lookupWorkbenchSpaceOperation:z.strictObject({...selected,scopeId:opaqueKey,idempotencyKey:z.uuid()}),
 getConversationSpaceContext:z.strictObject({...selected,conversationId:opaqueKey}),
 getRunDirectoryBinding:z.strictObject({...selected,runId:ids.run}),
 getProjectDirectoryBinding:z.strictObject({...selected,projectId:ids.project,commit:z.string().regex(/^[a-f0-9]{40}$/)}),
};
export type WorkbenchSpaceMethod=keyof typeof workbenchSpaceRequests;
export type SpaceParsed<M extends WorkbenchSpaceMethod>=z.output<(typeof workbenchSpaceRequests)[M]>;
export type WorkbenchRepositoryIdentity={root:string;gitDirectory:string;commonDirectory:string;rootDevice:string;rootFileId:string;gitDevice:string;gitFileId:string};
export interface WorkbenchSpaceResults{
 listWorkbenchSpaces:z.output<typeof workbenchSpaceList>;getWorkbenchSpace:z.output<typeof workbenchSpaceView>;
 createWorkbenchSpace:OperationResult;updateWorkbenchSpace:OperationResult;deleteWorkbenchSpace:OperationResult;moveConversationSpace:OperationResult;lookupWorkbenchSpaceOperation:OperationResult|null;
 getConversationSpaceContext:{spaceId:string;spaceName:string;description:string;runId:string|null;binding:z.output<typeof workbenchDirectoryBinding>|null;baseCommit:string|null};
 getRunDirectoryBinding:{binding:z.output<typeof workbenchDirectoryBinding>|null;repository:WorkbenchRepositoryIdentity|null};
 getProjectDirectoryBinding:{binding:z.output<typeof workbenchDirectoryBinding>|null;repository:WorkbenchRepositoryIdentity|null};
}
