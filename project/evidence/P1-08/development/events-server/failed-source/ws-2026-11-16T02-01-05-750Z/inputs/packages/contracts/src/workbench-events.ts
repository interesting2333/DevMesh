import {z} from 'zod';
import {ids,opaqueKey,epoch} from './primitives.js';
import {domainEvent} from './events.js';

export const workbenchEventSubscription=z.strictObject({schemaVersion:z.literal(1),principalId:opaqueKey,projectId:ids.project,runId:ids.run,afterSeq:epoch});
const context={schemaVersion:z.literal(1),projectId:ids.project,runId:ids.run};
export const workbenchEventFrame=z.discriminatedUnion('kind',[
 z.strictObject({...context,kind:z.literal('subscribed'),afterSeq:epoch}),
 z.strictObject({...context,kind:z.literal('domain-event'),event:domainEvent}).superRefine((v,ctx)=>{if(v.projectId!==v.event.projectId||v.runId!==v.event.runId)ctx.addIssue({code:'custom',message:'Event context must match its envelope'});}),
 z.strictObject({...context,kind:z.literal('caught-up'),throughSeq:epoch}),
 z.strictObject({...context,kind:z.literal('resync-required'),afterSeq:epoch,reason:z.enum(['RETAINED_GAP','CURSOR_AHEAD','BUFFER_OVERFLOW','SLOW_CLIENT','CATCHUP_LIMIT','STORAGE_UNAVAILABLE','PROTOCOL_INVALID'])}),
 z.strictObject({...context,kind:z.literal('authorization-lost')}),
 z.strictObject({...context,kind:z.literal('service-stopping')}),
]);
export type WorkbenchEventSubscription=z.output<typeof workbenchEventSubscription>;
export type WorkbenchEventFrame=z.output<typeof workbenchEventFrame>;
