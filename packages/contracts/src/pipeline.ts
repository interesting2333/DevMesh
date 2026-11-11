import {z} from 'zod';
import {opaqueKey} from './primitives.js';
import {relativeFile} from './outputs.js';

export const pipelineStage=z.strictObject({stageId:opaqueKey,kind:z.enum(['install','unit','e2e','build','preview']),
  imageDigest:z.string().regex(/^[a-z0-9][a-z0-9._/:~-]*@sha256:[a-f0-9]{64}$/),
  resourceLimits:z.strictObject({cpu:z.number().positive().max(64),memoryMiB:z.number().int().min(64).max(131072),pids:z.number().int().min(16).max(256),temporaryMiB:z.number().int().min(16).max(10240),timeoutMs:z.number().int().min(100).max(600000)}),
  networkPolicyRef:z.literal('none'),outputSpec:z.array(relativeFile).max(32)});
export const pipelineDefinition=z.strictObject({definitionId:opaqueKey,version:opaqueKey,stages:z.array(pipelineStage).min(1).max(8)}).superRefine((v,ctx)=>{
  if(new Set(v.stages.map(s=>s.stageId)).size!==v.stages.length)ctx.addIssue({code:'custom',path:['stages'],message:'Stage identities must be unique'});
});
export type PipelineDefinition=z.output<typeof pipelineDefinition>;
