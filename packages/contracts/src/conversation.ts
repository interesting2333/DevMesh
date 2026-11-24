import {assistantEnvironment} from './assistant-task.js';
import {z} from 'zod';
import {opaqueKey,ids,epoch,revision,inputText,timestamp} from './primitives.js';
import {attachmentIds} from './input.js';
import {planReviewView} from './plans.js';
import {understandingView} from './preparation.js';

export const conversationMode=z.enum(['EXECUTE','PLAN']);
export const conversationState=z.enum(['IDLE','QUEUED','THINKING','WORKING','WAITING_USER','WAITING_CONFIRMATION','PAUSING','PAUSED','CANCELLING','CANCELLED','BLOCKED','UNKNOWN','COMPLETED']);
export const conversationCreate=z.strictObject({clientConversationId:z.uuid(),title:z.string().trim().min(1).max(80).optional(),projectId:ids.project.optional(),spaceId:opaqueKey.optional()});
export const conversationPlanBasis=z.strictObject({runId:ids.run,planRevision:revision,requirementRevision:revision,reviewHash:z.string().regex(/^[a-f0-9]{64}$/),resourceRevision:revision});
const conversationTitle=z.string().trim().min(1).max(80).refine(v=>!Array.from(v).some(c=>c.charCodeAt(0)<32||c.charCodeAt(0)===127),'Title must be one line');
export const conversationRename=z.strictObject({name:conversationTitle,previousName:z.string().min(1).max(80)});
export const conversationDelete=z.strictObject({revision});
export const conversationDeletionState=z.strictObject({conversationId:opaqueKey,title:z.string().max(80),revision,canDelete:z.boolean(),reason:z.enum(['ACTIVE','UNRESOLVED','READ_ONLY']).nullable()});
export const conversationConfirm=z.strictObject({inputRevision:epoch,basis:conversationPlanBasis,carryForwardHash:z.string().regex(/^[a-f0-9]{64}$/).optional()});
export const conversationInput=z.strictObject({clientMessageId:z.uuid(),text:z.union([inputText,z.literal('')]),attachmentIds,executionMode:conversationMode,observedPlan:conversationPlanBasis.optional()}).refine(v=>v.text.trim().length>0||v.attachmentIds.length>0,'A message needs text or an attachment');
export const conversationControl=z.strictObject({action:z.enum(['PAUSE','RESUME','CANCEL','RECONCILE']),revision,sourceMessageSeq:revision.optional()});
export const conversationDecision=z.strictObject({
 reply:inputText,
 intent:z.enum(['QUERY','ANALYZE','EDIT','DEVELOP','ADJUST','ANSWER','PROGRESS','CONFIRM','CONTROL','UNCLEAR']),
 action:z.enum(['NONE','INVESTIGATE','EXECUTE_TASK','DEVELOP','UPDATE','ANSWERS','CONFIRM','PAUSE','RESUME','CANCEL']),
 goal:z.string().max(20000),planOnly:z.boolean(),
 answers:z.array(z.strictObject({questionId:ids.question,questionRevision:revision,value:z.json()})).max(100),
});
export const conversationMessage=z.strictObject({messageId:opaqueKey,seq:revision,role:z.enum(['user','assistant','progress']),text:z.string().max(20000),attachmentIds,createdAt:timestamp,turnId:opaqueKey.nullable(),planBasis:conversationPlanBasis.nullable()});
export const conversationSummary=z.strictObject({conversationId:opaqueKey,title:z.string().max(80),projectId:ids.project.nullable(),runId:ids.run.nullable(),executionMode:conversationMode,state:conversationState,revision,inputRevision:epoch,lastSeq:epoch,updatedAt:timestamp,blockReason:opaqueKey.nullable(),spaceId:opaqueKey.optional(),directoryPath:z.string().max(2048).nullable().optional()});
export const conversationView=z.strictObject({conversation:conversationSummary,canWrite:z.boolean(),messages:z.array(conversationMessage).max(100),nextCursor:epoch.nullable(),pending:z.array(z.strictObject({turnId:opaqueKey,state:opaqueKey,errorCode:opaqueKey.nullable()})).max(10)});
export const conversationCapabilities=z.strictObject({model:z.boolean(),preparation:z.boolean(),execution:z.boolean(),assistant:assistantEnvironment.optional(),reason:opaqueKey.nullable()});
export const conversationWorkContext=z.strictObject({
 conversationId:opaqueKey,inputRevision:epoch,
 project:z.strictObject({projectId:ids.project,name:z.string().max(80)}),
 run:z.strictObject({runId:ids.run,resourceRevision:revision,phase:opaqueKey,controlGate:opaqueKey,terminalOutcome:opaqueKey.nullable(),currentPlanRevision:revision.nullable(),currentRequirementRevision:revision.nullable()}),
 understanding:understandingView,plan:planReviewView.nullable(),
 works:z.array(z.strictObject({workId:ids.work,goal:z.string().max(20000),role:opaqueKey,state:opaqueKey.nullable(),blockedReason:opaqueKey.nullable()})).max(30),
}).nullable();
export type ConversationSummary=z.output<typeof conversationSummary>;
export type ConversationMessage=z.output<typeof conversationMessage>;
export type ConversationView=z.output<typeof conversationView>;
export type ConversationDecision=z.output<typeof conversationDecision>;
