import {z} from 'zod';
import {opaqueKey,revision,epoch,timestamp,gitCommit} from './primitives.js';
const name=z.string().trim().min(1).max(80).refine(v=>!Array.from(v).some(c=>c.codePointAt(0)!<32||c.codePointAt(0)===127),'A space needs a single-line name');
export const workbenchDirectoryBinding=z.strictObject({path:z.string().min(1).max(2048),device:z.string().max(100),fileId:z.string().max(100),gitDirectory:z.string().max(2048),gitDevice:z.string().max(100),gitFileId:z.string().max(100),head:gitCommit,branch:z.string().max(256)});
export const workbenchSpaceCreate=z.strictObject({clientSpaceId:z.uuid(),name,description:z.string().trim().max(500).default(''),directory:z.string().trim().min(1).max(2048).nullable().default(null)});
export const workbenchSpaceUpdate=z.strictObject({revision,name,description:z.string().trim().max(500),directory:z.string().trim().min(1).max(2048).nullable()});
export const workbenchSpaceDelete=z.strictObject({revision});
export const workbenchSpaceView=z.strictObject({spaceId:opaqueKey,name,description:z.string().max(500),revision,isDefault:z.boolean(),persisted:z.boolean(),directory:workbenchDirectoryBinding.nullable(),taskCount:epoch,createdAt:timestamp.nullable(),updatedAt:timestamp.nullable()});
export const workbenchSpaceList=z.strictObject({spaces:z.array(workbenchSpaceView).max(100),legacySpaceId:opaqueKey});
export const workbenchSpaceMove=z.strictObject({revision,targetSpaceId:opaqueKey});
export const workbenchDirectoryPage=z.strictObject({roots:z.array(z.strictObject({path:z.string().max(2048),name:z.string().max(256)})).max(20),path:z.string().max(2048).nullable(),parent:z.string().max(2048).nullable(),directories:z.array(z.strictObject({name:z.string().max(256),path:z.string().max(2048)})).max(200)});
export const workbenchSpaceOperation=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('CREATE'),body:workbenchSpaceCreate}),
 z.strictObject({kind:z.literal('UPDATE'),spaceId:opaqueKey,body:workbenchSpaceUpdate}),
 z.strictObject({kind:z.literal('DELETE'),spaceId:opaqueKey,body:workbenchSpaceDelete}),
 z.strictObject({kind:z.literal('MOVE'),conversationId:opaqueKey,body:workbenchSpaceMove}),
]);
export type WorkbenchSpace=z.output<typeof workbenchSpaceView>;
export type WorkbenchDirectoryBinding=z.output<typeof workbenchDirectoryBinding>;
