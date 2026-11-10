import { z } from 'zod';
import { ids, epoch, opaqueKey, timestamp } from './primitives.js';
import { ContractError, parseContract } from './errors.js';

const resourceFields = { resourceId: opaqueKey, access: z.enum(['read', 'write']) };
const workflowResource = z.strictObject({ kind: z.enum(['snapshot', 'workspace', 'projectRepository', 'dataset']), ...resourceFields });
const invocationResource = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('snapshot'), resourceId: opaqueKey, access: z.literal('read') }),
  z.strictObject({ kind: z.literal('workspace'), ...resourceFields }),
]);
const common = {
  schemaVersion: z.literal('devmesh.permit.v1'), grantId: ids.grant, activationId: ids.activation,
  notBefore: timestamp, expiresAt: timestamp,
};
export const workflowOwner = z.strictObject({ ownerKind: z.literal('workflowAttempt'), runId: ids.run, runEpoch: epoch, workId: ids.work, workEpoch: epoch, attemptId: ids.attempt });
export const invocationOwner = z.strictObject({ ownerKind: z.literal('invocationAttempt'), invocationId: ids.invocation, invocationEpoch: epoch, invocationAttemptId: ids.invocationAttempt });
export const executionOwner = z.discriminatedUnion('ownerKind', [workflowOwner, invocationOwner]);
export const executionPermit = z.discriminatedUnion('ownerKind', [
  workflowOwner.extend({ ...common, resources: z.array(workflowResource).min(1).max(64) }),
  invocationOwner.extend({ ...common, resources: z.array(invocationResource).min(1).max(64) }),
]).superRefine((permit, ctx) => {
  if (Date.parse(permit.expiresAt) <= Date.parse(permit.notBefore)) ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'expiresAt must follow notBefore' });
});
export type ExecutionOwner = z.infer<typeof executionOwner>;
export type ExecutionPermit = z.infer<typeof executionPermit>;
export type ResourceRequest = z.infer<typeof workflowResource>;

const includes = (scopes: readonly ResourceRequest[], requested: ResourceRequest) => scopes.some(scope =>
  scope.kind === requested.kind && scope.resourceId === requested.resourceId && (scope.access === 'write' || requested.access === 'read'));

/** authority is read from authenticated, committed grant/host facts, never caller JSON. */
export function assertPermit(input: unknown, authority: ExecutionPermit, requested: ResourceRequest, nowMs: number): ExecutionPermit {
  const permit = parseContract(executionPermit, input);
  const current = parseContract(executionPermit, authority);
  parseContract(workflowResource, requested);
  if (!Number.isFinite(nowMs)) throw new TypeError('A trusted finite clock is required');
  const ownerKeys = current.ownerKind === 'workflowAttempt'
    ? ['ownerKind', 'runId', 'runEpoch', 'workId', 'workEpoch', 'attemptId', 'activationId', 'grantId'] as const
    : ['ownerKind', 'invocationId', 'invocationEpoch', 'invocationAttemptId', 'activationId', 'grantId'] as const;
  const actual = permit as unknown as Record<string, unknown>;
  const expected = current as unknown as Record<string, unknown>;
  if (ownerKeys.some(key => actual[key] !== expected[key])) throw new ContractError('PERMIT_REVOKED', 403, '执行宿主或许可代际已变化。');
  if ([permit, current].some(p => nowMs < Date.parse(p.notBefore) || nowMs >= Date.parse(p.expiresAt))) throw new ContractError('PERMIT_EXPIRED', 403, '许可尚未生效或已过期。');
  if (Date.parse(permit.notBefore) < Date.parse(current.notBefore) || Date.parse(permit.expiresAt) > Date.parse(current.expiresAt)) throw new ContractError('PERMIT_REVOKED', 403, '许可有效期超出当前授权。');
  if (permit.resources.some(scope => !includes(current.resources, scope)) || !includes(permit.resources, requested)) throw new ContractError('PERMIT_SCOPE_DENIED', 403, '请求资源超出许可范围。');
  return permit;
}
