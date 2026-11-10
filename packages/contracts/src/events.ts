import { z } from 'zod';
import { ids, revision, epoch, timestamp, attemptState, a2aTaskState, operationStatus, runState, artifactRef, opaqueKey, protocolTaskId } from './primitives.js';

export const eventPayloads = {
  InputSaved: z.strictObject({ messageId: ids.message }),
  UnderstandingUpdated: z.strictObject({ understandingRef: artifactRef }),
  QuestionAnswered: z.strictObject({ questionId: ids.question, questionRevision: revision }),
  PlanPublished: z.strictObject({ planRevision: revision, planRef: artifactRef }),
  PlanConfirmed: z.strictObject({ planRevision: revision, decisionId: ids.decision }),
  WorkAdmitted: z.strictObject({ workId: ids.work, attemptId: ids.attempt, activationId: ids.activation }),
  AttemptStateChanged: z.strictObject({ attemptId: ids.attempt, state: attemptState }),
  A2ATaskObserved: z.strictObject({ attemptId: ids.attempt, endpointId: opaqueKey, taskId: protocolTaskId, state: a2aTaskState }),
  ToolOperationUpdated: z.strictObject({ toolOperationId: ids.operation, status: operationStatus }),
  ArtifactRegistered: z.strictObject({ artifact: artifactRef }),
  ChangeApplied: z.strictObject({ changeId: ids.change, requirementRevision: revision, planRevision: revision }),
  DecisionSaved: z.strictObject({ decisionId: ids.decision }),
  ControlProgress: z.strictObject({ state: runState, controlRevision: revision, runEpoch: epoch }),
  ConfigurationApplied: z.strictObject({ configurationRef: artifactRef }),
  CandidateUpdated: z.strictObject({ candidateId: ids.candidate, state: z.enum(['PREPARING', 'READY', 'BLOCKED', 'SUPERSEDED']) }),
  ReleaseAccepted: z.strictObject({ candidateId: ids.candidate, releaseId: ids.release }),
  PreviewStateChanged: z.strictObject({ previewId: ids.preview, state: z.enum(['PREPARING', 'RUNNING', 'STOPPING', 'STOPPED', 'FAILED', 'OUTCOME_UNKNOWN']) }),
  ExportUpdated: z.strictObject({ exportId: ids.export, status: operationStatus }),
} as const;
const base = {
  schemaVersion: z.literal(1), eventId: ids.event, projectId: ids.project, runId: ids.run, seq: revision,
  occurredAt: timestamp, observedAt: timestamp, timeSource: z.enum(['producer', 'observed']),
  resourceRevision: revision, requirementRevision: revision.nullable(), planRevision: revision.nullable(), operationId: ids.operation,
  workId: ids.work.optional(), attemptId: ids.attempt.optional(),
};
const eventOf = <T extends keyof typeof eventPayloads>(type: T) => z.strictObject({ ...base, type: z.literal(type), payload: eventPayloads[type] });
export const domainEvent = z.discriminatedUnion('type', [
  eventOf('InputSaved'), eventOf('UnderstandingUpdated'), eventOf('QuestionAnswered'), eventOf('PlanPublished'),
  eventOf('PlanConfirmed'), eventOf('WorkAdmitted'), eventOf('AttemptStateChanged'), eventOf('A2ATaskObserved'),
  eventOf('ToolOperationUpdated'), eventOf('ArtifactRegistered'), eventOf('ChangeApplied'), eventOf('DecisionSaved'),
  eventOf('ControlProgress'), eventOf('ConfigurationApplied'), eventOf('CandidateUpdated'), eventOf('ReleaseAccepted'),
  eventOf('PreviewStateChanged'), eventOf('ExportUpdated'),
]).superRefine((event, ctx) => {
  if (event.timeSource === 'observed' && event.occurredAt !== event.observedAt) ctx.addIssue({ code: 'custom', path: ['occurredAt'], message: 'Observed time must equal occurredAt when no producer time exists' });
  const payload = event.payload as Record<string, unknown>;
  for (const key of ['attemptId', 'workId', 'planRevision', 'requirementRevision'] as const) {
    if (payload[key] !== undefined && event[key] !== undefined && payload[key] !== event[key]) ctx.addIssue({ code: 'custom', path: ['payload', key], message: 'Payload and persisted envelope must agree' });
  }
});
export type DomainEvent = z.infer<typeof domainEvent>;
export const ephemeralTokenDelta = z.strictObject({ kind: z.literal('token-delta'), streamId: opaqueKey, text: z.string() });
