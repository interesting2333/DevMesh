import {z} from 'zod';
import {opaqueKey,ids,epoch,revision,conversationCreate,conversationInput,conversationControl,conversationDecision,conversationState,conversationPlanBasis,conversationRename,conversationConfirm,conversationDelete,conversationDeletionState,workbenchDirectoryBinding} from '@devmesh/contracts';
import type {ConversationSummary,ConversationView,ConversationDecision} from '@devmesh/contracts';
import type {OperationResult} from './protocol.js';
const principal={principalId:opaqueKey},meta=z.strictObject({...principal,scopeId:opaqueKey,idempotencyKey:z.uuid()});
const selected={...principal,conversationId:opaqueKey};
const claim={turnId:opaqueKey,claimToken:z.uuid()};
export const conversationRequests={
 createConversation:z.strictObject({meta,body:conversationCreate,binding:workbenchDirectoryBinding.nullable().optional(),spaceRevision:revision.optional()}),
 appendConversationMessage:z.strictObject({meta,conversationId:opaqueKey,body:conversationInput}),
 getConversation:z.strictObject({...selected,afterSeq:epoch.default(0),limit:z.number().int().min(1).max(100).default(50)}),
 listConversations:z.strictObject({...principal,spaceId:opaqueKey.optional(),query:z.string().max(80).optional(),before:z.string().max(200).optional(),limit:z.number().int().min(1).max(100).default(30)}),
 controlConversation:z.strictObject({meta,conversationId:opaqueKey,body:conversationControl}),
 renameConversation:z.strictObject({meta,conversationId:opaqueKey,body:conversationRename}),
 deleteConversation:z.strictObject({meta,conversationId:opaqueKey,body:conversationDelete}),
 getConversationDeletionState:z.strictObject(selected),
 lookupConversationOperation:z.strictObject({...selected,idempotencyKey:z.uuid()}),
 getConversationPageTarget:z.strictObject(selected),
 confirmConversationPlan:z.strictObject({meta,conversationId:opaqueKey,body:conversationConfirm}),
 claimConversationTurn:z.strictObject({workerId:opaqueKey}),
 getConversationContext:z.strictObject(claim),
 getConversationExecutionFacts:z.strictObject(selected),
 narrowConversationPlan:z.strictObject(claim),
 registerConversationChange:z.strictObject({...claim,changeId:ids.change,goal:z.string().min(1).max(20000),attachmentIds:z.array(ids.attachment).max(3)}),
 listConversationChanges:z.strictObject({limit:z.number().int().min(1).max(100).default(20),includeManual:z.boolean().default(false)}),
 listConversationTextControls:z.strictObject({limit:z.number().int().min(1).max(100).default(30)}),
 markConversationTextControl:z.strictObject({...selected,seq:epoch}),
 settleConversationResume:z.strictObject({...selected,key:z.uuid()}),
 adoptConversationChange:z.strictObject({meta,changeId:ids.change,bodyHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 prepareConversationAction:z.strictObject({...claim,action:z.record(z.string(),z.json())}),
 markConversationModelSent:z.strictObject({...claim,request:z.record(z.string(),z.json()),reservedTokens:z.number().int().positive(),tokenLimit:z.number().int().positive()}),
 saveConversationResponse:z.strictObject({...claim,response:conversationDecision}),
 saveConversationInvalidResponse:z.strictObject({...claim,response:z.record(z.string(),z.json()),errorCode:opaqueKey}),
 completeConversationTurn:z.strictObject({...claim,state:conversationState,result:z.record(z.string(),z.json()).default({})}),
 failConversationTurn:z.strictObject({...claim,errorCode:opaqueKey,unknown:z.boolean()}),
 bindConversationRun:z.strictObject({...claim,projectId:ids.project,runId:ids.run}),
 admitConversationPlan:z.strictObject({meta,conversationId:opaqueKey,planRevision:revision,requirementRevision:revision,reviewHash:z.string().regex(/^[a-f0-9]{64}$/)}),
 listWorkingConversations:z.strictObject({limit:z.number().int().min(1).max(100).default(20)}),
 observeConversation:z.strictObject({...selected,inputRevision:epoch,key:z.string().max(200),text:z.string().max(20000),state:conversationState,reason:opaqueKey.nullable().default(null),planBasis:conversationPlanBasis.optional()}),
 recoverConversationTurns:z.strictObject({}),
};
export type ConversationMethod=keyof typeof conversationRequests;
export type ConversationParsed<M extends ConversationMethod>=z.output<(typeof conversationRequests)[M]>;
export interface ConversationTurn {
 turnId:string;claimToken:string;actionKey:string;inputRevision:number;state:string;
 request:Record<string,unknown>|null;response:ConversationDecision|null;action:Record<string,unknown>|null;
 conversation:ConversationSummary;messages:ConversationView['messages'];principalId:string;
}
export interface ConversationResults {
 createConversation:OperationResult;appendConversationMessage:OperationResult;controlConversation:OperationResult;
 renameConversation:OperationResult;confirmConversationPlan:OperationResult;
 deleteConversation:OperationResult;getConversationDeletionState:z.output<typeof conversationDeletionState>;lookupConversationOperation:OperationResult|null;
 getConversationPageTarget:{conversationId:string|null};
 getConversation:ConversationView;listConversations:{conversations:ConversationSummary[];nextCursor:string|null};
 claimConversationTurn:ConversationTurn|null;getConversationContext:ConversationTurn;prepareConversationAction:ConversationTurn;
 narrowConversationPlan:ConversationSummary;
 getConversationExecutionFacts:{works:{workId:string;goal:string;role:string;state:string|null;blockedReason:string|null}[]};
 registerConversationChange:{changeId:string;pauseKey:string};
 listConversationChanges:{changeId:string;conversationId:string;principalId:string;runId:string;goal:string;adoptKey:string;pauseKey:string}[];
 listConversationTextControls:{conversation:ConversationSummary;principalId:string;text:string;seq:number}[];
 markConversationTextControl:{checked:boolean};
 settleConversationResume:ConversationSummary;
 adoptConversationChange:OperationResult;
 markConversationModelSent:ConversationTurn;saveConversationResponse:ConversationTurn;completeConversationTurn:ConversationSummary;
 saveConversationInvalidResponse:ConversationSummary;
 failConversationTurn:ConversationSummary;bindConversationRun:ConversationSummary;listWorkingConversations:{principalId:string;conversation:ConversationSummary;resumeRequested:boolean;resumeWaitingInput:boolean;resumeKey:string|null}[];
 admitConversationPlan:OperationResult;
 observeConversation:ConversationSummary;recoverConversationTurns:{unknown:number;ready:number};
}
