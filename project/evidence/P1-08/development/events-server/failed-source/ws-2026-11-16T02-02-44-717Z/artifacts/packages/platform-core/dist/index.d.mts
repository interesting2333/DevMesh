import { a as ReleaseExportSchedulerOptions, i as ReleaseExportScheduler, n as ServerConfig, r as loadConfig, t as ConfigError } from "./config-C1HphGDv.mjs";
import { WorkflowScheduler, WorkflowSchedulerOptions } from "./scheduler.mjs";
import { AcceptanceAbortRecoveryBackend, AcceptancePreparationBackend, AcceptanceReadiness, DatasetPreparationBackend, PreviewEffect, PreviewExecutionBackend, ReleasePublication, ReleasePublicationBackend, Request, SqliteStorage } from "@devmesh/storage-sqlite";
import { LocalContentStore, LocalStorage, SessionStore } from "@devmesh/blob-store";
import { CredentialResolver, mountInternalAgents } from "@devmesh/a2a-adapter";
import { PreparationConsumer, RuntimeConsumer, RuntimeTool, RuntimeWorkspaceLifecycle } from "@devmesh/agent-runtime";
import { AddressInfo } from "node:net";
import { IdentityResolver, PreviewAccessGateway, WorkbenchEventLimits, mountInputApi } from "@devmesh/input-api";
import { WorkflowMcpOptions, WorkflowMcpServices } from "@devmesh/mcp-tools";

//#region src/acceptance-consumer.d.ts
interface AcceptancePreparationBinding {
  projectId: string;
  policyHash: string;
  principalId: string;
  backendRef: string;
  runnerId: string;
  backend: AcceptancePreparationBackend;
}
interface AcceptancePreparationConsumerOptions {
  bindings: readonly AcceptancePreparationBinding[];
  pollIntervalMs?: number;
  maxConcurrentProjects?: number;
  maxScopesPerPass?: number;
  pageSize?: number;
}
/** Trusted local composition only. No T5, publication or cleanup is performed. */
declare class AcceptancePreparationConsumer {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  lastError: string | null;
  private constructor();
  static create(storage: Pick<SqliteStorage, 'request'>, options: AcceptancePreparationConsumerOptions): Promise<AcceptancePreparationConsumer>;
  tick(): Promise<void>;
  private consume;
  private consumeScope;
  private recordError;
  start(): void;
  stopAdmission(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/abort-consumer.d.ts
interface AcceptanceAbortBinding {
  projectId: string;
  policyHash: string;
  principalId: string;
  backendRef: string;
  runnerId: string;
  backend: AcceptanceAbortRecoveryBackend;
}
interface AcceptanceAbortConsumerOptions {
  bindings: readonly AcceptanceAbortBinding[];
  pollIntervalMs?: number;
  maxConcurrentProjects?: number;
  maxScopesPerPass?: number;
  pageSize?: number;
}
/** Consumes already recorded original aborts only; no new owner decision or T5. */
declare class AcceptanceAbortConsumer {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  lastError: string | null;
  private constructor();
  static create(storage: Pick<SqliteStorage, 'request'>, options: AcceptanceAbortConsumerOptions): Promise<AcceptanceAbortConsumer>;
  tick(): Promise<void>;
  private consume;
  private consumeScope;
  private recordCode;
  private recordError;
  start(): void;
  stopAdmission(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/publication-consumer.d.ts
interface ReleasePublicationBinding {
  projectId: string;
  policyHash: string;
  principalId: string;
  backendRef: string;
  runnerId: string;
  backend: ReleasePublicationBackend;
}
interface ReleasePublicationConsumerOptions {
  bindings: readonly ReleasePublicationBinding[];
  pollIntervalMs?: number;
  maxConcurrentProjects?: number;
  maxScopesPerPass?: number;
  pageSize?: number;
}
/** Consumes only already accepted original Outbox records. No T5 or data migration. */
declare class ReleasePublicationConsumer {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  lastError: string | null;
  private constructor();
  static create(storage: Pick<SqliteStorage, 'request'>, options: ReleasePublicationConsumerOptions): Promise<ReleasePublicationConsumer>;
  tick(): Promise<void>;
  private consume;
  private consumeScope;
  private recordError;
  start(): void;
  stopAdmission(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/dataset-consumer.d.ts
interface PreviewDatasetBinding {
  projectId: string;
  policyHash: string;
  principalId: string;
  backendRef: string;
  runnerId: string;
  backend: DatasetPreparationBackend;
}
interface PreviewDatasetConsumerOptions {
  bindings: readonly PreviewDatasetBinding[];
  pollIntervalMs?: number;
  maxConcurrentProjects?: number;
  maxScopesPerPass?: number;
  pageSize?: number;
}
/** Consume recorded dataset preparation only. No new owner decisions or acceptance. */
declare class PreviewDatasetConsumer {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  lastError: string | null;
  private constructor();
  static create(storage: Pick<SqliteStorage, 'request'>, options: PreviewDatasetConsumerOptions): Promise<PreviewDatasetConsumer>;
  tick(): Promise<void>;
  private consume;
  private consumeScope;
  private recordError;
  start(): void;
  stopAdmission(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/preview-consumer.d.ts
interface PreviewLifecycleBinding {
  projectId: string;
  policyHash: string;
  principalId: string;
  backendRef: string;
  runnerId: string;
  backend: PreviewExecutionBackend;
}
interface PreviewLifecycleConsumerOptions {
  bindings: readonly PreviewLifecycleBinding[];
  pollIntervalMs?: number;
  maxConcurrentProjects?: number;
  maxScopesPerPass?: number;
  pageSize?: number;
}
/** Original preview lifecycle recovery only. No dataset creation or acceptance. */
declare class PreviewLifecycleConsumer {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  lastError: string | null;
  private constructor();
  static create(storage: Pick<SqliteStorage, 'request'>, options: PreviewLifecycleConsumerOptions): Promise<PreviewLifecycleConsumer>;
  tick(): Promise<void>;
  private consume;
  private consumeScope;
  private recordError;
  start(): void;
  stopAdmission(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/dataset-preparer.d.ts
declare class DatasetPreparer {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly principalId: string;
  readonly backend?: DatasetPreparationBackend | undefined;
  constructor(storage: Pick<SqliteStorage, 'request'>, principalId: string, backend?: DatasetPreparationBackend | undefined);
  stopAdmission(): void;
  advance(operationId: string): Promise<PreviewEffect>;
  recoverPage(input: {
    projectId: string;
    policyHash: string;
    afterSequence?: number;
    limit?: number;
  }): Promise<{
    results: {
      operationId: string;
      state: "UNKNOWN" | "PREPARED" | "SENT" | "SUCCEEDED" | "FAILED";
      errorCode: string | null;
    }[];
    nextSequence: number | null;
  }>;
}
//#endregion
//#region src/acceptance-preparer.d.ts
/** Explicit trusted composition; no backend or model identity is installed by default. */
declare class AcceptancePreparer {
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly principalId: string;
  readonly backend?: AcceptancePreparationBackend | undefined;
  constructor(storage: Pick<SqliteStorage, 'request'>, principalId: string, backend?: AcceptancePreparationBackend | undefined);
  advance(operationId: string, signal?: AbortSignal): Promise<AcceptanceReadiness>;
  recoverPage(input: {
    projectId: string;
    policyHash: string;
    afterSequence?: number;
    limit?: number;
  }): Promise<{
    results: ({
      operationId: string;
      state: "READY" | "STALE" | "UNPREPARED" | "UNAVAILABLE";
      errorCode: string | null;
    } | {
      operationId: string;
      state: string;
      errorCode: string;
    })[];
    nextSequence: number | null;
  }>;
}
//#endregion
//#region src/release-acceptor.d.ts
/** Trusted material preflight outside T5. Infrastructure readiness is supplied
 * by the separately configured preparer; this never creates or publishes it. */
declare class ReleaseAcceptor {
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly content: Pick<LocalContentStore, 'readBytes'>;
  constructor(storage: Pick<SqliteStorage, 'request'>, content: Pick<LocalContentStore, 'readBytes'>);
  accept(input: Request<'commitReleaseAcceptance'>): Promise<import("@devmesh/storage-sqlite").OperationResult>;
}
//#endregion
//#region src/release-publisher.d.ts
/** Trusted explicit composition. No physical publisher is installed by default. */
declare class ReleasePublisher {
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly principalId: string;
  readonly backend?: ReleasePublicationBackend | undefined;
  constructor(storage: Pick<SqliteStorage, 'request'>, principalId: string, backend?: ReleasePublicationBackend | undefined);
  advance(releaseId: string, signal?: AbortSignal): Promise<ReleasePublication>;
  recoverPage(input: {
    projectId: string;
    policyHash: string;
    afterSequence?: number;
    limit?: number;
  }): Promise<{
    results: ({
      releaseId: string;
      state: "UNKNOWN" | "PUBLISHED" | "SENT" | "PENDING";
      errorCode: string | null;
    } | {
      releaseId: string;
      state: string;
      errorCode: string;
    })[];
    nextSequence: number | null;
  }>;
}
//#endregion
//#region src/preview-lifecycle.d.ts
interface PreviewRecoveryScope {
  projectId: string;
  policyHash: string;
}
declare class PreviewLifecycleManager {
  #private;
  readonly storage: Pick<SqliteStorage, 'request'>;
  readonly principalId: string;
  readonly backend?: PreviewExecutionBackend | undefined;
  constructor(storage: Pick<SqliteStorage, 'request'>, principalId: string, backend?: PreviewExecutionBackend | undefined);
  advance(operationId: string): Promise<PreviewEffect>;
  reconcilePreview(previewId: string): Promise<import("@devmesh/storage-sqlite").PreviewView>;
  reconcilePage(input: PreviewRecoveryScope & {
    afterSequence?: number;
    limit?: number;
  }): Promise<{
    results: ({
      previewId: string;
      state: "UNKNOWN" | "READY" | "EXPIRED" | "STARTING" | "STOPPING" | "STOPPED";
      errorCode: null;
    } | {
      previewId: string;
      state: "UNKNOWN" | "READY" | "EXPIRED" | "STARTING" | "STOPPING" | "STOPPED";
      errorCode: string;
    })[];
    nextSequence: number | null;
  }>;
  start(scopes: readonly PreviewRecoveryScope[], options?: {
    pollIntervalMs?: number;
    onError?: (code: string) => void;
  }): Promise<void>;
  stopAdmission(): void;
  close(): Promise<void>;
}
//#endregion
//#region src/index.d.ts
interface FoundationServer {
  readonly address: Readonly<AddressInfo>;
  stop(): Promise<void>;
  services?: {
    local: LocalStorage;
    content: LocalContentStore;
    sessions: SessionStore;
  } | undefined;
  agents?: ReturnType<typeof mountInternalAgents> | undefined;
  consumer?: RuntimeConsumer | undefined;
  preparationConsumer?: PreparationConsumer | undefined;
  scheduler?: WorkflowScheduler | undefined;
  inputApi?: ReturnType<typeof mountInputApi> | undefined;
  mcp?: WorkflowMcpServices | undefined;
  releaseExports?: ReleaseExportScheduler | undefined;
  acceptancePreparation?: AcceptancePreparationConsumer | undefined;
  releasePublication?: ReleasePublicationConsumer | undefined;
  acceptanceAbort?: AcceptanceAbortConsumer | undefined;
  previewLifecycle?: PreviewLifecycleConsumer | undefined;
  previewDatasets?: PreviewDatasetConsumer | undefined;
}
declare function startPlatform(config: Readonly<ServerConfig>, options?: {
  resolveCredential?: CredentialResolver;
  runtimeTools?: RuntimeTool[];
  workspaceLifecycle?: (services: NonNullable<FoundationServer['services']>) => Promise<RuntimeWorkspaceLifecycle> | RuntimeWorkspaceLifecycle;
  identityResolver?: IdentityResolver;
  workbenchEvents?: WorkbenchEventLimits;
  previewGateway?: PreviewAccessGateway;
  previewPolicies?: Readonly<Record<string, string>>;
  previewDatasets?: (services: NonNullable<FoundationServer['services']>) => Promise<PreviewDatasetConsumerOptions> | PreviewDatasetConsumerOptions;
  previewLifecycle?: (services: NonNullable<FoundationServer['services']>) => Promise<PreviewLifecycleConsumerOptions> | PreviewLifecycleConsumerOptions;
  acceptancePolicies?: Readonly<Record<string, string>>;
  acceptancePreparation?: (services: NonNullable<FoundationServer['services']>) => Promise<AcceptancePreparationConsumerOptions> | AcceptancePreparationConsumerOptions;
  acceptanceAbort?: (services: NonNullable<FoundationServer['services']>) => Promise<AcceptanceAbortConsumerOptions> | AcceptanceAbortConsumerOptions;
  releasePublication?: (services: NonNullable<FoundationServer['services']>) => Promise<ReleasePublicationConsumerOptions> | ReleasePublicationConsumerOptions;
  scheduler?: WorkflowSchedulerOptions;
  mcp?: (services: NonNullable<FoundationServer['services']>) => Promise<WorkflowMcpOptions> | WorkflowMcpOptions;
}): Promise<FoundationServer>;
//#endregion
export { type AcceptanceAbortBinding, AcceptanceAbortConsumer, type AcceptanceAbortConsumerOptions, type AcceptancePreparationBinding, AcceptancePreparationConsumer, type AcceptancePreparationConsumerOptions, AcceptancePreparer, ConfigError, DatasetPreparer, FoundationServer, type PreviewDatasetBinding, PreviewDatasetConsumer, type PreviewDatasetConsumerOptions, type PreviewLifecycleBinding, PreviewLifecycleConsumer, type PreviewLifecycleConsumerOptions, PreviewLifecycleManager, type PreviewRecoveryScope, ReleaseAcceptor, ReleaseExportScheduler, type ReleaseExportSchedulerOptions, type ReleasePublicationBinding, ReleasePublicationConsumer, type ReleasePublicationConsumerOptions, ReleasePublisher, type ServerConfig, type WorkflowSchedulerOptions, loadConfig, startPlatform };
//# sourceMappingURL=index.d.mts.map