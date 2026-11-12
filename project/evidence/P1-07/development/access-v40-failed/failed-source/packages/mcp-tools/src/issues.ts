import {z} from 'zod';
import {ids,opaqueKey} from '@devmesh/contracts';
import {issueCreateArgs,issueLinkArgs,issueVerifyArgs} from '@devmesh/storage-sqlite';
import type {SqliteStorage} from '@devmesh/storage-sqlite';
import type {ToolDefinition} from './protocol.js';

export const issuesGetArgs=z.strictObject({issueId:opaqueKey,afterRevision:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(20).default(20)});
export const issuesOperationArgs=z.strictObject({operationId:ids.operation});
export function issueTools(storage:SqliteStorage):ToolDefinition[]{
  return [
    {name:'issues.create',description:'Create a sourced issue with a durable original operation; this is a finding, not verified failure',schema:issueCreateArgs,action:'write',effectClass:'NONIDEMPOTENT_WRITE',execute:({operationId,args,permit})=>storage.request('createIssue',{operationId,permit,args:issueCreateArgs.parse(args)})},
    {name:'issues.linkFix',description:'Link an approved fix Work using the exact current issue revision',schema:issueLinkArgs,action:'write',effectClass:'IDEMPOTENT_WRITE',execute:({operationId,args,permit})=>storage.request('linkIssueFix',{operationId,permit,args:issueLinkArgs.parse(args)})},
    {name:'issues.recordVerification',description:'Record sourced fix verification; a pass requires persisted tester evidence for that exact code commit',schema:issueVerifyArgs,action:'write',effectClass:'IDEMPOTENT_WRITE',execute:({operationId,args,permit})=>storage.request('recordIssueVerification',{operationId,permit,args:issueVerifyArgs.parse(args)})},
    {name:'issues.get',description:'Read an issue and a bounded page of immutable revision history in the original Run',schema:issuesGetArgs,action:'read',effectClass:'READ',execute:({args,permit})=>storage.request('getIssue',{permit,...issuesGetArgs.parse(args)})},
    {name:'issues.by-operation',description:'Reconcile an issue mutation using its original host and operation identity',schema:issuesOperationArgs,action:'read',effectClass:'READ',execute:({args,permit})=>storage.request('getIssueOperation',{permit,...issuesOperationArgs.parse(args)})},
  ];
}
