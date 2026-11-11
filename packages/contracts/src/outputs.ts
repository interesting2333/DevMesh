import { z } from 'zod';
import { ids, revision, role, nonemptyText, opaqueKey, artifactRef, gitCommit, sha256 } from './primitives.js';

export const relativeFile = z.string().min(1).max(512).refine(path => !path.startsWith('/') && !path.includes('\\') && !path.includes(':') && path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'Expected a relative workspace file');
export const sourceRef = z.discriminatedUnion('kind', [
  artifactRef.extend({ kind: z.literal('artifact') }),
  z.strictObject({ kind: z.literal('message'), messageId: ids.message }),
  z.strictObject({ kind: z.literal('requirement'), requirementId: ids.requirement, requirementRevision: revision }),
]);
export const requirement = z.strictObject({
  id: ids.requirement, statement: nonemptyText, sourceRefs: z.array(sourceRef).min(1), acceptance: z.array(nonemptyText).min(1),
});
export const question = z.strictObject({
  id: ids.question, required: z.boolean(), reason: nonemptyText, blockingScope: z.array(ids.work), defaultOption: nonemptyText.optional(),
});
export const completionCheck = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('artifact-exists'), outputSlot: opaqueKey }),
  z.strictObject({ kind: z.literal('schema-valid'), outputSlot: opaqueKey, schemaId: opaqueKey }),
  z.strictObject({ kind: z.literal('commit-resolved'), outputSlot: opaqueKey }),
  z.strictObject({ kind: z.literal('command-exit-zero'), checkId: ids.check }),
  z.strictObject({ kind: z.literal('required-tests-pass'), checkId: ids.check }),
  z.strictObject({ kind: z.literal('coverage-threshold'), lines: z.number().min(80).max(100), branches: z.number().min(70).max(100) }),
  z.strictObject({ kind: z.literal('human-decision'), checkId: ids.check }),
]);
export const workRevision = z.strictObject({
  workId: ids.work, workRevision: revision, role, goal: nonemptyText,
  inputRefs: z.array(z.discriminatedUnion('kind', [
    artifactRef.extend({ kind: z.literal('artifact') }),
    z.strictObject({ kind: z.literal('output'), workId: ids.work, outputSlot: opaqueKey }),
  ])).max(64),
  outputSpec: z.array(z.strictObject({ slot: opaqueKey, schemaId: opaqueKey })).min(1).max(64),
  completionChecks: z.array(completionCheck).min(1).max(64),
  dependencies: z.array(z.strictObject({ workId: ids.work, requiredOutcome: z.enum(['success', 'completed-with-findings']) })).max(29),
  writeScope: z.array(relativeFile).max(64),
  estimatedResources: z.strictObject({ cpu: z.number().positive().max(64), memoryMiB: revision, timeoutMs: revision }),
  requirementIds: z.array(ids.requirement).min(1).max(200),
});
export const planDraft = z.strictObject({
  requirementRevision: revision, works: z.array(workRevision).min(1).max(30),
});

export const productOutput = z.strictObject({
  schemaVersion: z.literal('devmesh.requirements.v1'), role: z.literal('product'),
  requirements: z.array(requirement).min(1), assumptions: z.array(nonemptyText), questions: z.array(question),
});
export const architectOutput = z.strictObject({
  schemaVersion: z.literal('devmesh.architecture.v1'), role: z.literal('architect'),
  interfaces: z.array(z.strictObject({ name: opaqueKey, specificationRef: artifactRef })),
  planDraft, risks: z.array(nonemptyText), capabilityFit: z.strictObject({ supported: z.boolean(), gaps: z.array(nonemptyText) }),
});
export const developerOutput = z.strictObject({
  schemaVersion: z.literal('devmesh.development-result.v1'), role: z.literal('developer'),
  baseCommit: gitCommit, resultCommit: gitCommit, changedFiles: z.array(relativeFile),
  checkRefs: z.array(artifactRef), unverified: z.array(nonemptyText),
  handoffProposal: z.strictObject({ targetRole: role, goal: nonemptyText, artifactRefs: z.array(artifactRef), reason: nonemptyText }).nullable(),
});
const commitReportRef = artifactRef.extend({ targetCommit: gitCommit });
export const testerOutput = z.strictObject({
  schemaVersion: z.literal('devmesh.test-result.v1'), role: z.literal('tester'), targetCommit: gitCommit,
  caseResults: z.array(z.strictObject({ checkId: ids.check, requirementIds: z.array(ids.requirement).min(1), status: z.enum(['PASSED', 'FAILED', 'SKIPPED', 'MISSING']), reportRef: commitReportRef })).min(1),
  coverageRef: commitReportRef,
  defects: z.array(z.strictObject({ id: opaqueKey, severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']), description: nonemptyText, evidenceRefs: z.array(artifactRef).min(1) })),
  buildRef: commitReportRef, previewRef: commitReportRef.optional(),
}).superRefine((result, ctx) => {
  const reports = [result.coverageRef, result.buildRef, ...(result.previewRef ? [result.previewRef] : []), ...result.caseResults.map(c => c.reportRef)];
  if (reports.some(report => report.targetCommit !== result.targetCommit)) ctx.addIssue({ code: 'custom', path: ['targetCommit'], message: 'All reports must bind the exact targetCommit' });
});
export const roleOutput = z.discriminatedUnion('role', [productOutput, architectOutput, developerOutput, testerOutput]);
export type RoleOutput = z.infer<typeof roleOutput>;
export type WorkRevision = z.infer<typeof workRevision>;

export const workDelegation = z.strictObject({
  schemaVersion: z.literal('devmesh.work.v1'), operationId: ids.operation,
  runId: ids.run, workId: ids.work, workRevision: revision, attemptId: ids.attempt,
  endpointId: opaqueKey, endpointRevision: revision, grantId: ids.grant, activationId: ids.activation,
  runEpoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), workEpoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  requirementRevision: revision, planRevision: revision, inputManifestId: ids.manifest, roleSnapshotId: ids.roleSnapshot,
  originRole: role, targetRole: role, requestedOutputSchema: opaqueKey,
});
export const invocationDelegation = z.strictObject({
  schemaVersion: z.literal('devmesh.invocation.v1'), operationId: ids.operation,
  invocationId: ids.invocation, invocationAttemptId: ids.invocationAttempt, invocationEpoch: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  activationId: ids.activation, grantId: ids.grant, endpointId: opaqueKey, endpointRevision: revision,
  inputManifestRef: artifactRef, definitionSnapshotRef: artifactRef,
});
export const inputManifest = z.strictObject({
  schemaVersion: z.literal('devmesh.input-manifest.v1'),
  requirements: z.array(z.strictObject({ requirementId: ids.requirement, sha256 })),
  interfaces: z.array(artifactRef), artifacts: z.array(artifactRef), codeCommit: gitCommit.nullable(),
  templateVersion: opaqueKey, checkConfigHash: sha256, decisionIds: z.array(ids.decision),
});
