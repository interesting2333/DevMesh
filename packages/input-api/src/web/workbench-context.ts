import {z} from 'zod';
import {ids,opaqueKey} from '@devmesh/contracts';
export const workbenchSelection=z.strictObject({projectId:ids.project,runId:ids.run.optional()});
export const workbenchBoot=z.strictObject({principalId:opaqueKey,selection:workbenchSelection.nullable(),conversationEnabled:z.boolean().optional(),conversationId:opaqueKey.optional(),spaceId:opaqueKey.optional()});
export type WorkbenchBoot=z.output<typeof workbenchBoot>;
export type WorkbenchSelection=z.output<typeof workbenchSelection>;
