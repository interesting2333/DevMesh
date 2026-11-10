import { z } from 'zod';
import { opaqueKey,ids,relativeFile } from '@devmesh/contracts';
import { RunnerClient,imageDigest,resourceLimits,commandSpec,ownerKey,attemptKey } from '@devmesh/runner';
import type { Job } from '@devmesh/runner';
import { ToolError } from './protocol.js';
import type { ToolDefinition } from './protocol.js';
const checkSchema=z.strictObject({checkId:opaqueKey,imageDigest,commandSpec,resourceLimits,networkPolicyRef:z.literal('none'),outputSpec:z.array(relativeFile).max(32)});
export type CheckDefinition=z.output<typeof checkSchema>;
export const testsStartArgs=z.strictObject({checkId:opaqueKey,workspaceRef:opaqueKey});
export const testsJobArgs=z.strictObject({jobId:ids.job});
export const testsOperationArgs=z.strictObject({operationId:ids.operation});
export function testTools(runner:RunnerClient,definitions:readonly CheckDefinition[]):ToolDefinition[]{
 const checks=definitions.map(v=>checkSchema.parse(structuredClone(v)));if(new Set(checks.map(v=>v.checkId)).size!==checks.length)throw new ToolError('MCP_CHECK_CONFIGURATION_INVALID','not-sent');
 const scoped=(job:Job,permit:Job['request']['permit'])=>{const p=job.request.permit;if(ownerKey(p)!==ownerKey(permit)||attemptKey(p)!==attemptKey(permit)||p.activationId!==permit.activationId||p.grantId!==permit.grantId)throw new ToolError('MCP_JOB_NOT_FOUND','not-sent');return job;};
 const byJob=async(args:Record<string,unknown>,permit:Job['request']['permit'])=>scoped(await runner.get(testsJobArgs.parse(args).jobId),permit);
 return [
  {name:'tests.start',description:'Admit an approved isolated check job; an acknowledgement is not a test verdict',schema:testsStartArgs,action:'write',effectClass:'NONIDEMPOTENT_WRITE',async execute({operationId,args,permit}){const a=testsStartArgs.parse(args),check=checks.find(c=>c.checkId===a.checkId);if(!check)throw new ToolError('MCP_CHECK_DENIED','not-sent');return runner.start({schemaVersion:'devmesh.runner-job.v1',operationId:ids.operation.parse(operationId),permit,imageDigest:check.imageDigest,workspaceRef:a.workspaceRef,commandSpec:check.commandSpec,resourceLimits:check.resourceLimits,networkPolicyRef:check.networkPolicyRef,outputSpec:check.outputSpec});}},
  {name:'tests.get',description:'Query the original isolated job without starting another',schema:testsJobArgs,action:'read',effectClass:'READ',async execute({args,permit}){return byJob(args,permit);}},
  {name:'tests.stop',description:'Request stop of the original isolated job; verify exit separately',schema:testsJobArgs,action:'stop',effectClass:'IDEMPOTENT_WRITE',async execute({args,permit}){const job=await byJob(args,permit);return runner.stop(job.jobId);}},
  {name:'tests.by-operation',description:'Reconcile an uncertain admission using its original operation ID',schema:testsOperationArgs,action:'read',effectClass:'READ',async execute({args,permit}){const a=testsOperationArgs.parse(args);return scoped(await runner.byOperation(a.operationId),permit);}},
 ];
}
