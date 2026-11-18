import {randomUUID} from 'node:crypto';
import {workbenchPlanningFixture} from './workbench-planning.mjs';
export async function planConversation(t,options={}){
 const f=await workbenchPlanningFixture(t,options),created=await f.storage.request('createConversation',{meta:{principalId:'user_1',scopeId:'conversations.create',idempotencyKey:randomUUID()},body:{clientConversationId:randomUUID(),projectId:f.projectId}}),id=created.result.conversationId;
 await f.storage.request('appendConversationMessage',{meta:{principalId:'user_1',scopeId:id,idempotencyKey:randomUUID()},conversationId:id,body:{clientMessageId:randomUUID(),text:'先制定来源导航方案','attachmentIds':[],executionMode:'PLAN'}});
 const turn=await f.storage.request('claimConversationTurn',{workerId:'desktop.test'}),claim={turnId:turn.turnId,claimToken:turn.claimToken};
 await f.storage.request('markConversationModelSent',{...claim,request:{fixture:true},reservedTokens:1,tokenLimit:10000});
 await f.storage.request('saveConversationResponse',{...claim,response:{reply:'方案已整理，请审阅本期范围和检查。',intent:'DEVELOP',action:'NONE',goal:'开发来源导航与权限验证',planOnly:true,answers:[]}});
 await f.storage.request('bindConversationRun',{...claim,projectId:f.projectId,runId:f.runId});await f.storage.request('completeConversationTurn',{...claim,state:'WAITING_CONFIRMATION'});
 const review=await f.storage.request('getPlanReview',{principalId:'user_1',runId:f.runId}),v=await f.storage.request('getConversation',{principalId:'user_1',conversationId:id});
 const body={inputRevision:v.conversation.inputRevision,basis:{runId:f.runId,planRevision:review.planRevision,requirementRevision:review.requirementRevision,reviewHash:review.reviewHash,resourceRevision:review.resourceRevision}},command={meta:{principalId:'user_1',scopeId:id,idempotencyKey:randomUUID()},conversationId:id,body};
 return {...f,id,claim,body,command,view:()=>f.storage.request('getConversation',{principalId:'user_1',conversationId:id})};
}
