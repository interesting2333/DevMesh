import { z } from 'zod';
import { ids, revision, epoch, opaqueKey, sha256, gitCommit, inputText, timestamp } from './primitives.js';
import { requirement, question, sourceRef } from './outputs.js';

const unique=(values:readonly string[])=>new Set(values).size===values.length;
export const preparationRole=z.enum(['product','architect']);
export const preparationQuestion=question.extend({
  prompt:inputText,sourceRefs:z.array(sourceRef).min(1).max(64),
  options:z.array(z.strictObject({id:opaqueKey,label:inputText})).max(32).default([]),
}).superRefine((q,ctx)=>{
  if(!unique(q.options.map(o=>o.id)))ctx.addIssue({code:'custom',path:['options'],message:'Options must have unique IDs'});
  if(q.defaultOption!==undefined&&!q.options.some(o=>o.id===q.defaultOption))ctx.addIssue({code:'custom',path:['defaultOption'],message:'Default must name an available option'});
});
export const understandingOutput=z.strictObject({
  schemaVersion:z.literal('devmesh.understanding.v1'),role:z.literal('product'),
  requirements:z.array(requirement).min(1).max(200),assumptions:z.array(inputText).max(100),
  questions:z.array(preparationQuestion).max(100),
  conflicts:z.array(z.strictObject({id:opaqueKey,description:inputText,sourceRefs:z.array(sourceRef).min(2).max(64),questionId:ids.question})).max(100),
}).superRefine((v,ctx)=>{
  if(!unique(v.requirements.map(r=>r.id)))ctx.addIssue({code:'custom',path:['requirements'],message:'Requirement IDs must be unique'});
  if(!unique(v.questions.map(q=>q.id)))ctx.addIssue({code:'custom',path:['questions'],message:'Question IDs must be unique'});
  if(!unique(v.conflicts.map(c=>c.id)))ctx.addIssue({code:'custom',path:['conflicts'],message:'Conflict IDs must be unique'});
  for(const [i,c] of v.conflicts.entries()){
    if(!v.questions.some(q=>q.id===c.questionId&&q.required))ctx.addIssue({code:'custom',path:['conflicts',i,'questionId'],message:'Conflicting sources require an explicit required question'});
    const keys=new Set(c.sourceRefs.map(ref=>ref.kind==='message'?ref.messageId:ref.kind==='artifact'?ref.artifactId:`${ref.requirementId}:${ref.requirementRevision}`));
    if(keys.size<2)ctx.addIssue({code:'custom',path:['conflicts',i,'sourceRefs'],message:'A conflict requires two distinct sources'});
  }
});
export const answerQuestionsInput=z.strictObject({answers:z.array(z.strictObject({questionId:ids.question,questionRevision:revision,value:z.json()})).min(1).max(100)}).superRefine((v,ctx)=>{
  if(!unique(v.answers.map(a=>a.questionId)))ctx.addIssue({code:'custom',path:['answers'],message:'An answer batch must contain each question once'});
  if(new TextEncoder().encode(JSON.stringify(v)).byteLength>128*1024)ctx.addIssue({code:'custom',message:'Answer batch exceeds 128 KiB'});
});
export const retryUnderstandingInput=z.strictObject({failedInterpretationOperationId:ids.operation});
export const understandingView=z.strictObject({
  runId:ids.run,requirementRevision:revision.nullable(),understanding:understandingOutput.nullable(),
  questions:z.array(z.strictObject({questionId:ids.question,questionRevision:revision,requirementBasis:revision,state:z.enum(['OPEN','ANSWERED','SUPERSEDED']),content:preparationQuestion,
    answer:z.strictObject({answerId:opaqueKey,value:z.json(),actor:opaqueKey,createdAt:timestamp}).nullable()})).max(100),
  jobs:z.array(z.strictObject({jobId:ids.job,operationId:ids.operation,purpose:z.enum(['UNDERSTAND','INTERPRET','PLAN']),role:preparationRole,state:opaqueKey,retryOf:ids.job.nullable(),errorCode:opaqueKey.nullable(),resultArtifactId:ids.artifact.nullable()})).max(50),
  pendingInputCount:epoch,answerInterventions:epoch,
});
export const preparationProfile=z.strictObject({
  providerId:opaqueKey,model:opaqueKey,promptHash:sha256,providerHash:sha256,
  maxOutputTokens:z.number().int().positive().max(32768),tokenLimit:z.number().int().positive(),
  maxInputBytes:z.number().int().min(1024).max(2*1024*1024),
});
export const preparationDelegation=z.strictObject({
  schemaVersion:z.literal('devmesh.preparation.v1'),operationId:ids.operation,
  jobId:ids.job,preparationAttemptId:opaqueKey,runId:ids.run,runEpoch:epoch,
  activationId:ids.activation,grantId:ids.grant,endpointId:opaqueKey,endpointRevision:revision,
  role:preparationRole,inputHash:sha256,profileHash:sha256,basisHash:sha256,
});
export const preparationSource=z.strictObject({
  ref:sourceRef,contentHash:sha256,byteSize:z.number().int().nonnegative().max(2*1024*1024),
  label:z.string().min(1).max(512),
});
export const preparationInput=z.strictObject({
  schemaVersion:z.literal('devmesh.preparation-input.v1'),runId:ids.run,role:preparationRole,
  basisHash:sha256,requirementRevision:revision.nullable(),baseCommit:gitCommit,
  sources:z.array(preparationSource).min(1).max(256),answerIds:z.array(opaqueKey).max(1000),
});
export type UnderstandingOutput=z.infer<typeof understandingOutput>;
export type PreparationProfile=z.infer<typeof preparationProfile>;
