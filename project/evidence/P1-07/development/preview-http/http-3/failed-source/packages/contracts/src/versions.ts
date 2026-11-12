import { z } from 'zod';
import { ContractError, parseContract } from './errors.js';
import { revision, sha256 } from './primitives.js';

export const strongETag = z.string().regex(/^"r[1-9][0-9]*"$/).refine(value => Number.isSafeInteger(Number(value.slice(2, -1))), 'Revision must be a safe integer');
export const contentBasis = z.strictObject({ revision, reviewHash: sha256 });
export type ContentBasis = z.infer<typeof contentBasis>;

/** Invoke only for NEW operations, after authentication, ACL and idempotency lookup. */
export function assertResourceVersion(ifMatch: string | undefined, currentRevision: number): void {
  parseContract(revision, currentRevision);
  if (ifMatch === undefined) throw new ContractError('PRECONDITION_REQUIRED', 428, '请提供 If-Match。');
  if (!strongETag.safeParse(ifMatch).success) throw new ContractError('PRECONDITION_FAILED', 412, '需要单一强版本 ETag。');
  const submittedRevision = Number(ifMatch.slice(2, -1));
  if (submittedRevision !== currentRevision) throw new ContractError('PRECONDITION_FAILED', 412, '对象已经更新，请重新获取。', { submittedRevision, currentRevision });
}

export function assertContentBasis(submitted: ContentBasis, current: ContentBasis, kind: 'plan' | 'content' = 'content'): void {
  parseContract(contentBasis, submitted);
  parseContract(contentBasis, current);
  if (submitted.revision !== current.revision || submitted.reviewHash !== current.reviewHash) throw new ContractError(kind === 'plan' ? 'PLAN_SUPERSEDED' : 'BASIS_SUPERSEDED', 409, '确认依据已经失效。', { submittedRevision: submitted.revision, currentRevision: current.revision });
}
