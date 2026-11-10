import { z } from 'zod';

// Prefixes identify local resources; the suffix is opaque, not a sequence number.
const id = <P extends string>(prefix: P) => z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]{0,127}$`)).brand<P>();
export const ids = {
  project: id('prj'), userTask: id('task'), run: id('run'), work: id('work'), attempt: id('attempt'),
  invocation: id('invocation'), invocationAttempt: id('iattempt'), activation: id('activation'), grant: id('grant'),
  operation: id('op'), event: id('evt'), request: id('req'), artifact: id('artifact'), manifest: id('manifest'),
  roleSnapshot: id('role'), definitionSnapshot: id('definition'), candidate: id('candidate'), release: id('release'),
  question: id('question'), requirement: id('requirement'), session: id('session'), job: id('job'),
  attachment: id('attachment'), message: id('message'), change: id('change'), decision: id('decision'),
  preview: id('preview'), export: id('export'), analysis: id('analysis'), check: id('check'),
} as const;
export type ProjectId = z.infer<typeof ids.project>;
export type RunId = z.infer<typeof ids.run>;
export type AttemptId = z.infer<typeof ids.attempt>;
export type InvocationId = z.infer<typeof ids.invocation>;
export type InvocationAttemptId = z.infer<typeof ids.invocationAttempt>;
export const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const epoch = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const gitCommit = z.string().regex(/^[a-f0-9]{40}$/);
export const timestamp = z.iso.datetime({ precision: 3 });
export const role = z.enum(['product', 'architect', 'developer', 'tester']);
export const opaqueKey = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
export const protocolTaskId = z.string().min(1).max(512);
export const nonemptyText = z.string().min(1).max(20_000);
// Explicit Unicode mode: the pinned library's UTF-16 length must not reject emoji early.
export const inputText = z.string().regex(/^[\s\S]{1,20000}$/u);
export const projectName = z.string().regex(/^[\s\S]{1,80}$/u);
export const taskTitle = z.string().regex(/^[\s\S]{1,120}$/u);
export const artifactRef = z.strictObject({ artifactId: ids.artifact, sha256 });

export const runPhase = z.enum(['PREPARING', 'UNDERSTANDING', 'PLANNING', 'EXECUTING', 'VERIFYING', 'REVIEW']);
export const controlGate = z.enum(['OPEN', 'PAUSING', 'PAUSED', 'CANCELLING']);
export const terminalOutcome = z.enum(['COMPLETED', 'FAILED', 'CANCELLED']);
export const runState = z.strictObject({ phase: runPhase, controlGate, terminalOutcome: terminalOutcome.nullable() });
export const attemptState = z.enum(['RESERVED', 'SUBMITTED', 'WORKING', 'INPUT_REQUIRED', 'VERIFYING', 'OUTCOME_UNKNOWN', 'STOPPING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED', 'CANCELLED']);
export const invocationState = z.enum(['QUEUED', 'RUNNING', 'INPUT_REQUIRED', 'VERIFYING', 'STOPPING', 'OUTCOME_UNKNOWN', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
export const operationStatus = z.enum(['ACCEPTED', 'RUNNING', 'WAITING', 'SUCCEEDED', 'FAILED', 'OUTCOME_UNKNOWN']);
export const jobState = z.enum(['QUEUED', 'STARTING', 'RUNNING', 'STOPPING', 'EXITED', 'OUTCOME_UNKNOWN']);
export const a2aTaskState = z.enum(['submitted', 'working', 'input-required', 'auth-required', 'completed', 'failed', 'canceled', 'rejected']);
