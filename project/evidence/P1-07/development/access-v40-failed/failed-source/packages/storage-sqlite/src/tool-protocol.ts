import {z} from 'zod';
import {artifactRef,executionPermit,ids,opaqueKey,revision} from '@devmesh/contracts';
const authority={permit:executionPermit};
const issueId=opaqueKey;
export const issueCreateArgs=z.strictObject({title:z.string().trim().min(1).max(240),description:z.string().min(1).max(8000),severity:z.enum(['LOW','MEDIUM','HIGH','CRITICAL']),evidence:artifactRef});
export const issueLinkArgs=z.strictObject({issueId,issueRevision:revision,fixWorkId:ids.work});
export const issueVerifyArgs=z.strictObject({issueId,issueRevision:revision,fixAttemptId:ids.attempt,verificationAttemptId:ids.attempt.nullable(),outcome:z.enum(['PASSED','FAILED','NOT_VERIFIED']),evidence:artifactRef});
export const toolRequests={
  authorizeMcpAction:z.strictObject({...authority,toolName:opaqueKey,action:z.enum(['read','write','stop'])}),
  refreshMcpPermit:z.strictObject({...authority,toolName:opaqueKey,action:z.enum(['read','write','stop'])}),
  createIssue:z.strictObject({...authority,operationId:ids.operation,args:issueCreateArgs}),
  linkIssueFix:z.strictObject({...authority,operationId:ids.operation,args:issueLinkArgs}),
  recordIssueVerification:z.strictObject({...authority,operationId:ids.operation,args:issueVerifyArgs}),
  getIssue:z.strictObject({...authority,issueId,afterRevision:z.number().int().nonnegative().default(0),limit:z.number().int().min(1).max(20).default(20)}),
  getIssueOperation:z.strictObject({...authority,operationId:ids.operation}),
};
export type ToolMethod=keyof typeof toolRequests;
export type ToolInput<M extends ToolMethod>=z.output<(typeof toolRequests)[M]>;
export interface IssueView {issueId:string;projectId:string;runId:string;sourceAttemptId:string;revision:number;state:string;title:string;description:string;severity:string;fixWorkId:string|null;history:{revision:number;kind:string;operationId:string;value:unknown;createdAt:string}[];nextRevision:number|null}
export interface IssueOperation {operationId:string;toolName:string;issueId:string;issueRevision:number;state:'SUCCEEDED'}
export interface ToolResults {
  authorizeMcpAction:{principalId:string;projectId:string;runId:string};
  refreshMcpPermit:z.output<typeof executionPermit>;
  createIssue:IssueOperation;linkIssueFix:IssueOperation;recordIssueVerification:IssueOperation;
  getIssue:IssueView;getIssueOperation:IssueOperation;
}
