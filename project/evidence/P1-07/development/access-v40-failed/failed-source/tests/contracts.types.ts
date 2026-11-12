import type { ProjectId, RunId, ExecutionPermit, Command } from '../packages/contracts/src/index.js';

export function checkNominalIds(projectId: ProjectId, runId: RunId): RunId {
  // @ts-expect-error Local ID namespaces must remain different types.
  const wrong: RunId = projectId;
  void wrong;
  return runId;
}

export function checkOwnerNarrowing(permit: ExecutionPermit): string {
  if (permit.ownerKind === 'invocationAttempt') {
    // @ts-expect-error Invocation hosts have no workflow attempt foreign key.
    void permit.attemptId;
    return permit.invocationAttemptId;
  }
  return permit.attemptId;
}

export function checkCommandNarrowing(command: Command): number | undefined {
  if (command.type === 'ConfirmPlan') {
    const kind: 'plan' = command.target.kind;
    void kind;
    return command.payload.requirementRevision;
  }
  return undefined;
}
