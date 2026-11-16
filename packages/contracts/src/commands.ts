import { z } from 'zod';
import { ids, revision, sha256, inputText, opaqueKey, operationStatus, nonemptyText } from './primitives.js';
import { createProjectInput, saveMessageInput } from './input.js';
import { answerQuestionsInput } from './preparation.js';
import {acceptCandidateInput} from './release-acceptance.js';

export const idempotencyKey = z.uuid();
export const commandBodies = {
  CreateProject: createProjectInput,
  SaveMessage: saveMessageInput,
  AnswerQuestions: answerQuestionsInput,
  ConfirmPlan: z.strictObject({ requirementRevision: revision, reviewHash: sha256,carryForwardHash:sha256.optional() }),
  PlanFeedback: z.strictObject({ text: inputText, workIds: z.array(ids.work).optional() }),
  ProposeChange: z.strictObject({ proposedText: inputText, sourceMessageId: ids.message }),
  DecideChange: z.strictObject({ action: z.enum(['confirm', 'reject']), analysisId: ids.analysis.optional(), basisHash: sha256 }),
  PauseRun: z.strictObject({ reason: nonemptyText.optional() }),
  ResumeRun: z.strictObject({ controlRevision: revision, recoveryReviewHash: sha256 }),
  CancelRun: z.strictObject({ impactReviewHash: sha256 }),
  RetryWork: z.strictObject({ runId: ids.run, failedAttemptId: ids.attempt, retryReviewHash: sha256 }),
  RedoRun: z.strictObject({ redoReviewHash: sha256 }),
  AcceptCandidate: acceptCandidateInput,
} as const;
const targets = {
  creation: z.strictObject({ kind: z.literal('creation'), namespace: opaqueKey }),
  run: z.strictObject({ kind: z.literal('run'), projectId: ids.project, runId: ids.run }),
  plan: z.strictObject({ kind: z.literal('plan'), projectId: ids.project, runId: ids.run, planRevision: revision }),
  work: z.strictObject({ kind: z.literal('work'), projectId: ids.project, workId: ids.work }),
  change: z.strictObject({ kind: z.literal('change'), projectId: ids.project, changeId: ids.change }),
  candidate: z.strictObject({ kind: z.literal('candidate'), projectId: ids.project, candidateId: ids.candidate }),
};
export const commandTarget = z.discriminatedUnion('kind', [targets.creation, targets.run, targets.plan, targets.work, targets.change, targets.candidate]);
const envelope = <T extends keyof typeof commandBodies, K extends keyof typeof targets>(type: T, target: K) => z.strictObject({
  schemaVersion: z.literal(1), type: z.literal(type), idempotencyKey,
  target: targets[target],
  payload: commandBodies[type],
});
export const command = z.discriminatedUnion('type', [
  envelope('CreateProject', 'creation'), envelope('SaveMessage', 'run'), envelope('AnswerQuestions', 'run'),
  envelope('ConfirmPlan', 'plan'), envelope('PlanFeedback', 'plan'), envelope('ProposeChange', 'run'),
  envelope('DecideChange', 'change'), envelope('PauseRun', 'run'), envelope('ResumeRun', 'run'),
  envelope('CancelRun', 'run'), envelope('RetryWork', 'work'), envelope('RedoRun', 'run'), envelope('AcceptCandidate', 'candidate'),
]);
export type Command = z.infer<typeof command>;
export const operationReceipt = z.strictObject({
  operationId: ids.operation, status: operationStatus,
  resource: z.strictObject({ projectId: ids.project, runId: ids.run, revision }),
  links: z.strictObject({ operation: z.string().regex(/^\/api\/v1\/operations\/op_[A-Za-z0-9_-]+$/) }),
  result:z.record(z.string(),z.json()).optional(),
});
