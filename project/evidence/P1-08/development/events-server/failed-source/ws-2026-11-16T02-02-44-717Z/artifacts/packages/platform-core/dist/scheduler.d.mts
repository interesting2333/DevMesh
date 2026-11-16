import { Request, ScheduledCandidate, ScheduledDispatch, SqliteStorage } from "@devmesh/storage-sqlite";
import { AgentRegistry, CredentialResolver } from "@devmesh/a2a-adapter";

//#region src/scheduler.d.ts
type Admission = Request<'admitScheduledWork'>;
type ResourcePlan = Pick<Admission, 'runnerId' | 'reservationKey' | 'runnerCapacity' | 'runnerLimits' | 'templateVersion' | 'checkConfigHash' | 'maximumAttempts' | 'maximumReservedMs'> & Pick<Admission['work'], 'roleSnapshot' | 'resources'>;
interface WorkflowSchedulerOptions {
  callerId: string;
  /** Trusted pre-admission code preparation; Worker admission rechecks its current basis. */
  prepareCodeBasis?(candidate: ScheduledCandidate, signal: AbortSignal): Promise<void>;
  /** Trusted, read-only allocator. Absence of a concrete grant plan keeps the work queued. */
  planResources(candidate: ScheduledCandidate, signal: AbortSignal): Promise<ResourcePlan | null>;
}
declare class WorkflowScheduler {
  #private;
  readonly storage: SqliteStorage;
  readonly registry: AgentRegistry;
  readonly credential: CredentialResolver;
  readonly options: WorkflowSchedulerOptions;
  lastError: string | null;
  constructor(storage: SqliteStorage, registry: AgentRegistry, credential: CredentialResolver, options: WorkflowSchedulerOptions);
  send(dispatch: ScheduledDispatch, signal: AbortSignal): Promise<{
    state: string;
    taskId: string | null;
  } | undefined>;
  tick(signal: AbortSignal): Promise<import("@devmesh/storage-sqlite").OperationResult | null>;
  start(): void;
  stop(): Promise<void>;
}
//#endregion
export { WorkflowScheduler, WorkflowSchedulerOptions };
//# sourceMappingURL=scheduler.d.mts.map