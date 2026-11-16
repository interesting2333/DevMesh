import { z } from 'zod';
import {epoch, ids, opaqueKey, revision, sha256} from './primitives.js';

export const controlTargetKind = z.enum(['ATTEMPT', 'PREPARATION', 'PREVIEW', 'JOB', 'WORKSPACE']);
export const controlTargetState = z.enum(['PENDING', 'STOPPING', 'SAVED', 'RELEASED', 'UNKNOWN', 'FAILED']);
export const controlTargetView = z.strictObject({
  runId: ids.run,
  targetKind: controlTargetKind,
  targetId: opaqueKey,
  state: controlTargetState,
  attempts: z.number().int().nonnegative(),
  failureCode: z.string().min(1).max(200).nullable(),
  evidence: z.record(z.string(), z.json()).nullable(),
  lastCheckedAt: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});
export const runControlStatus = z.strictObject({
  runId: ids.run,
  controlGate: z.enum(['OPEN', 'PAUSING', 'PAUSED', 'CANCELLING']),
  controlRevision: revision,
  runEpoch: epoch,
  unresolved: z.array(controlTargetView),
  lastCheckedAt: z.string().min(1).nullable(),
  verificationOverdue: z.boolean(),
  recoveryReviewHash: sha256.nullable()
});
