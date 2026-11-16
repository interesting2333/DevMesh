import { LocalContentStore } from "@devmesh/blob-store";
import { CandidateBasis, CandidateIntegration, CandidateIntegrationStep, ExecutionHostView, ManagedRepository, ReleaseExportContext, Request, RuntimeWorkspaceResult, SourceArchive, SqliteStorage, WorkspaceAllocation, WorkspacePreservation, WorkspaceReclamation } from "@devmesh/storage-sqlite";
import { ExecutionPermit } from "@devmesh/contracts";
import { RunnerAuthority, RunnerClient } from "@devmesh/runner";

//#region src/git.d.ts
declare class WorkspaceError extends Error {
  readonly code: string;
  readonly outcome: 'not-sent' | 'unknown';
  constructor(code: string, outcome?: 'not-sent' | 'unknown');
}
type SourceEntry = {
  path: string;
  mode: '100644' | '100755';
  objectId: string;
  byteSize: number;
  sha256: string;
};
type SourceManifest = {
  commit: string;
  tree: string;
  files: SourceEntry[];
  byteSize: number;
  sha256: string;
};
type TemplateBasis = {
  version: string;
  baseCommit: string;
  sourceCommit: string;
  sourcePath: string;
  manifest: SourceManifest;
};
type GitIdentity = {
  root: string;
  gitDirectory: string;
  commonDirectory: string;
  kind: 'bare' | 'checkout';
};
type GitRefUpdate = {
  ref: string;
  commit: string;
  expected: string | null;
};
/** Only fixed operations are public. There is no caller-provided argv or URL. */
declare class ControlledGit {
  readonly identity: Readonly<GitIdentity>;
  readonly binary: string;
  readonly directories: readonly {
    path: string;
    dev: bigint;
    ino: bigint;
  }[];
  private constructor();
  static initialize(root: string, kind: GitIdentity['kind'], binary?: string): Promise<ControlledGit>;
  static open(root: string, kind: GitIdentity['kind'], binary?: string): Promise<ControlledGit>;
  private static run;
  private call;
  validate(signal?: AbortSignal): Promise<void>;
  commit(commit: string, signal?: AbortSignal): Promise<{
    commit: string;
    tree: string;
    parents: string[];
    body: string;
  }>;
  readBlob(objectId: string, signal?: AbortSignal): Promise<Buffer<ArrayBufferLike>>;
  treeEntries(commit: string, signal?: AbortSignal): Promise<({
    path: string;
    kind: "DIRECTORY";
    mode: "040000";
    objectId: string;
  } | {
    path: string;
    kind: "FILE";
    mode: "100644" | "100755";
    objectId: string;
  })[]>;
  manifest(commit: string, signal?: AbortSignal): Promise<SourceManifest>;
  private treeManifest;
  createTemplateBaseline(source: ControlledGit, sourceCommit: string, sourcePath: string, version: string, signal?: AbortSignal): Promise<TemplateBasis>;
  changedPaths(base: string, commit: string, signal?: AbortSignal): Promise<string[]>;
  exportCommit(commit: string, signal?: AbortSignal): Promise<Buffer<ArrayBufferLike>>;
  importCommit(pack: Buffer, commit: string, signal?: AbortSignal): Promise<SourceManifest>;
  checkout(commit: string, signal?: AbortSignal): Promise<SourceManifest>;
  verifyCheckout(manifest: SourceManifest, signal?: AbortSignal): Promise<SourceManifest>;
  checkoutAttempt(commit: string, attemptId: string, signal?: AbortSignal): Promise<SourceManifest>;
  verifyAttemptBranch(commit: string, attemptId: string, signal?: AbortSignal): Promise<void>;
  mergeBases(ours: string, theirs: string, signal?: AbortSignal): Promise<string[]>;
  /** Creates objects only; the caller must journal facts and fence project refs. */
  mergeTree(expectedBase: string | readonly string[], ours: string, theirs: string, signal?: AbortSignal): Promise<{
    clean: boolean;
    tree: string;
    base: string | null;
    bases: string[];
    ours: string;
    theirs: string;
    stages: {
      path: string;
      mode: "100644" | "100755";
      objectId: string;
      stage: 1 | 2 | 3;
    }[];
    messages: {
      paths: string[];
      kind: string;
      message: string;
    }[];
  }>;
  writeCommit(body: string, signal?: AbortSignal): Promise<string>;
  verifyPreservationBasis(base: string, expectedRefs: readonly {
    ref: string;
    commit: string;
  }[], signal?: AbortSignal): Promise<void>;
  readRef(name: string, signal?: AbortSignal): Promise<string | null>;
  head(signal?: AbortSignal): Promise<string | null>;
  updateRefs(updates: readonly GitRefUpdate[], signal?: AbortSignal): Promise<boolean>;
}
//#endregion
//#region src/allocation.d.ts
interface AllocationFence {
  release(): Promise<void>;
}
interface AllocationFencer {
  /** Must fence actual Runner writers; a timed control DB lock is insufficient. */
  acquire(input: {
    kind: 'project' | 'workspace';
    directoryRoot: string;
    resourceId: string;
    operationId: string;
    permit?: Request<'beginWorkspaceAllocation'>['permit'];
    purpose?: 'write' | 'cleanup';
  }, signal: AbortSignal): Promise<AllocationFence>;
}
interface LocalWorkspaceOptions {
  mode: 'local-development';
  storage: SqliteStorage;
  controlDataRoot: string;
  runnerDataRoot: string;
  backupRoot: string;
  runnerId: string;
  templates: ReadonlyMap<string, ControlledGit>;
  fencer: AllocationFencer;
}
/** Explicit local transport, with mandatory external fencing; never a CLI fallback. */
declare class LocalManagedWorkspaces {
  #private;
  readonly options: LocalWorkspaceOptions;
  readonly controlDataRoot: string;
  readonly runnerDataRoot: string;
  constructor(options: LocalWorkspaceOptions);
  private parent;
  private retained;
  ensureRepository(input: Request<'beginManagedRepository'>, signal?: AbortSignal): Promise<{
    record: ManagedRepository;
    provider: ControlledGit;
  }>;
  allocate(input: Request<'beginWorkspaceAllocation'>, signal?: AbortSignal): Promise<{
    record: WorkspaceAllocation;
    provider: ControlledGit;
  }>;
  static repositoryOperation(projectId: string, templateCommit: string): string;
}
//#endregion
//#region src/fencing.d.ts
interface LocalRunnerFencerOptions {
  mode: 'local-development';
  runner: RunnerClient;
  controlDataRoot: string;
  runnerDataRoot: string;
  backupRoot: string;
  /** Explicit dead-owner tokens; never infer recovery from time or expired grants. */
  recoveryTokens?: ReadonlyMap<string, string>;
}
declare class LocalRunnerWorkspaceFencer implements AllocationFencer {
  #private;
  readonly options: LocalRunnerFencerOptions;
  readonly controlDataRoot: string;
  readonly runnerDataRoot: string;
  constructor(options: LocalRunnerFencerOptions);
  private active;
  private releaseRunner;
  acquire(input: Parameters<AllocationFencer['acquire']>[0], signal: AbortSignal): Promise<AllocationFence>;
}
/** Trusted Repo MCP adapter: consistent project→workspace lock order and Runner admission barrier. */
declare function createLocalRepoAcquire(fencer: LocalRunnerWorkspaceFencer): (binding: {
  root: string;
  attemptId: string;
  resourceId: string;
  projectResourceId: string;
}, signal: AbortSignal, access: {
  operationId: string;
  permit: ExecutionPermit;
  purpose: "read" | "write" | "reconcile";
}) => Promise<{
  release: () => Promise<void>;
}>;
//#endregion
//#region src/source-archives.d.ts
interface LocalSourceArchiveOptions {
  mode: 'local-development';
  storage: SqliteStorage;
  controlDataRoot: string;
  runnerDataRoot: string;
  backupRoot: string;
  fencer: AllocationFencer;
}
/** Source-object retention only. This ACK never authorizes workspace deletion. */
declare class LocalSourceArchives {
  readonly options: LocalSourceArchiveOptions;
  readonly controlDataRoot: string;
  readonly runnerDataRoot: string;
  constructor(options: LocalSourceArchiveOptions);
  private project;
  private source;
  private acknowledge;
  archive(input: Request<'beginSourceArchive'>, signal?: AbortSignal): Promise<SourceArchive>;
  reconcile(input: Request<'getSourceArchive'>, signal?: AbortSignal): Promise<SourceArchive>;
}
//#endregion
//#region src/candidate-integrations.d.ts
type Merge = Awaited<ReturnType<ControlledGit['mergeTree']>>;
interface CandidateConflictContext {
  record: CandidateIntegration;
  basis: CandidateBasis;
  step: CandidateIntegrationStep;
  repository: ControlledGit;
  signal: AbortSignal;
}
type CandidateMerge = Merge;
interface LocalCandidateIntegrationOptions {
  mode: 'local-development';
  storage: SqliteStorage;
  controlDataRoot: string;
  runnerDataRoot: string;
  backupRoot: string;
  fencer: AllocationFencer;
  conflicts?: {
    capture(context: CandidateConflictContext, merge: Merge): Promise<void>;
    recoverReport(context: CandidateConflictContext): Promise<Merge | null>;
    publish(context: CandidateConflictContext, merge: Merge): Promise<CandidateIntegration>;
    reconcile(context: CandidateConflictContext): Promise<CandidateIntegration>;
  };
}
/** Explicit local project service. No model-controlled SHA, argv or Host resurrection. */
declare class LocalCandidateIntegrations {
  readonly options: LocalCandidateIntegrationOptions;
  readonly controlDataRoot: string;
  constructor(options: LocalCandidateIntegrationOptions);
  private project;
  private source;
  private acknowledgeStep;
  private acknowledge;
  private retainedInput;
  integrate(input: Request<'beginCandidateIntegration'>, signal?: AbortSignal): Promise<CandidateIntegration>;
  /** Prepare a dependency-specific snapshot before scheduler admission. This is
   * a trusted hook, separate from its read-only resource planner. */
  prepareWorkInput(input: {
    principalId: string;
    runId: string;
    workId: string;
  }, signal?: AbortSignal): Promise<void>;
  reconcile(input: Request<'getCandidateIntegration'>, signal?: AbortSignal): Promise<CandidateIntegration>;
}
//#endregion
//#region src/candidate-conflicts.d.ts
/** Content publication retains the raw report and virtual stage-1 bytes before
 * preparing the step. No recovery path invokes merge-tree again. */
declare class LocalCandidateConflicts {
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  constructor(storage: SqliteStorage, content: LocalContentStore);
  private put;
  capture(c: CandidateConflictContext, merge: CandidateMerge): Promise<void>;
  private saved;
  recoverReport(c: CandidateConflictContext): Promise<CandidateMerge | null>;
  publish(c: CandidateConflictContext, merge: CandidateMerge): Promise<import("@devmesh/storage-sqlite").CandidateIntegration>;
  reconcile(c: CandidateConflictContext): Promise<import("@devmesh/storage-sqlite").CandidateIntegration>;
}
//#endregion
//#region src/workspace-materials.d.ts
interface MaterialIdentity {
  device: string;
  fileId: string;
}
type WorkspaceMaterialEntry = {
  kind: 'DIRECTORY';
  path: string;
  identity: MaterialIdentity;
  mode: number;
} | {
  kind: 'FILE';
  path: string;
  identity: MaterialIdentity;
  mode: number;
  links: number;
  mtimeNs: string;
  ctimeNs: string;
  byteSize: number;
  sha256: string;
} | {
  kind: 'ABSENT';
  path: string;
} | {
  kind: 'EXCLUDED';
  path: string;
  reason: 'retained-git-repository' | 'rebuildable-node-modules';
  identity: MaterialIdentity;
};
interface WorkspaceMaterialSnapshot {
  schemaVersion: 'devmesh.workspace-materials.v1';
  root: string;
  identity: MaterialIdentity;
  entries: WorkspaceMaterialEntry[];
  byteSize: number;
  sha256: string;
}
interface CapturedWorkspaceMaterials {
  snapshot: WorkspaceMaterialSnapshot;
  bytes: ReadonlyMap<string, Buffer>;
}
/** Read-only capture. The caller must hold the original workspace's actual
 * Runner/editor fence. This scan alone is never an archive or deletion ACK.
 * All regular files are captured, including Git-ignored and recovery bytes.
 * The only exclusions are owned Git storage and rebuildable node_modules. */
declare function captureWorkspaceMaterials(input: {
  root: string;
  baseFiles: readonly string[];
}, signal: AbortSignal): Promise<CapturedWorkspaceMaterials>;
/** Verifies the complete original snapshot, including identities, missing
 * markers, recovery files, ignored files and new additions under the fence. */
declare function verifyWorkspaceMaterials(snapshot: WorkspaceMaterialSnapshot, baseFiles: readonly string[], signal: AbortSignal): Promise<CapturedWorkspaceMaterials>;
//#endregion
//#region src/workspace-preservations.d.ts
interface LocalWorkspacePreservationOptions {
  mode: 'local-development';
  storage: SqliteStorage;
  content: LocalContentStore;
  controlDataRoot: string;
  runnerDataRoot: string;
  backupRoot: string;
  fencer: AllocationFencer;
  sourceArchives: LocalSourceArchives;
}
interface PreservedWorkspaceLease {
  record: WorkspacePreservation;
  parent: string;
  release(): Promise<void>;
}
/** Full original-material preservation. A durable control ACK and a separately
 * fsynced Runner-local receipt are required before the reclamation boundary.
 * This service never deletes a workspace or infers a stopped job from expiry. */
declare class LocalWorkspacePreservations {
  readonly options: LocalWorkspacePreservationOptions;
  readonly controlDataRoot: string;
  readonly runnerDataRoot: string;
  constructor(options: LocalWorkspacePreservationOptions);
  private acquire;
  private directories;
  private retained;
  private receiptPath;
  private receiptBytes;
  private receipt;
  private publish;
  private verifyContent;
  private settledRecovery;
  archive(input: Request<'beginWorkspacePreservation'>, signal?: AbortSignal): Promise<WorkspacePreservation>;
  reconcile(input: Request<'getWorkspacePreservation'>, signal?: AbortSignal): Promise<WorkspacePreservation>;
  /** Read-only complete archive proof. A reclamation caller holds its own
   * original project/workspace cleanup barriers while using this result. */
  verifyArchiveProof(input: Request<'assertWorkspacePreservationReclaimable'>, signal?: AbortSignal): Promise<WorkspacePreservation>;
  /** Read-only original checkout verification, called inside a cleanup barrier. */
  verifyReclaimable(input: Request<'assertWorkspacePreservationReclaimable'>, signal?: AbortSignal): Promise<WorkspacePreservation>;
  /** Caller retains the actual Runner barrier until isolation is complete. */
  acquireReclaimable(input: Request<'assertWorkspacePreservationReclaimable'>, signal?: AbortSignal): Promise<PreservedWorkspaceLease>;
}
//#endregion
//#region src/workspace-reclamations.d.ts
/** Exact-original local reclamation. The caller configures a trusted Runner
 * cleanup fencer; no backend is enabled by default. */
declare class LocalWorkspaceReclamations {
  readonly preservations: LocalWorkspacePreservations;
  readonly retentionMs: number;
  constructor(preservations: LocalWorkspacePreservations, options?: {
    retentionMs?: number;
  });
  private get storage();
  private paths;
  private acquire;
  private receiptPath;
  private receiptBytes;
  private receipt;
  private original;
  private relocated;
  private closed;
  private observeReply;
  reclaim(input: Request<'beginWorkspaceReclamation'>, signal?: AbortSignal): Promise<WorkspaceReclamation>;
  reconcile(input: Request<'getWorkspaceReclamation'>, signal?: AbortSignal): Promise<WorkspaceReclamation>;
}
//#endregion
//#region src/workspace-remnants.d.ts
/** Read-only verification of leftovers after an already proven DELETE_SENT.
 * Missing original entries are allowed; additions, replacements, changed bytes,
 * new external links and an unproven root are rejected. The caller still needs
 * the original archive ACK, isolation/delete receipts, current cleanup authority
 * and the actual Runner barrier. This function never authorizes or performs rm. */
declare function verifyWorkspaceRemnants(snapshot: WorkspaceMaterialSnapshot, root: string, signal: AbortSignal): Promise<{
  remainingEntries: number;
  remainingBytes: number;
}>;
//#endregion
//#region src/maintenance-authority.d.ts
/** Explicit local-development bridge for the Runner's separate cleanup scope.
 * The Runner authenticates controllerId before invoking this callback. Normal
 * execution authority and workspace admission are configured separately. */
declare function createLocalWorkspaceCleanupAuthority(options: {
  mode: 'local-development';
  storage: SqliteStorage;
  controllerId: string;
  runnerId: string;
}): NonNullable<RunnerAuthority['verifyWorkspaceCleanup']>;
/** Local managed-code execution, allocation fencing and cleanup all resolve
 * committed SQLite authority. A partial allocation can be fenced for recovery,
 * but it cannot admit a new job until its original READY fact exists. */
declare function createLocalManagedRunnerAuthority(options: {
  mode: 'local-development';
  storage: SqliteStorage;
  controllerId: string;
  runnerId: string;
}): RunnerAuthority;
//#endregion
//#region src/managed-bindings.d.ts
/** Trusted MCP resolver. Filesystem identity comes from the original durable
 * allocation ACK, including on the very first tool call after startup. */
declare function createLocalManagedBindingResolver(options: {
  mode: 'local-development';
  storage: SqliteStorage;
  runnerId: string;
  runnerDataRoot: string;
}): (workspaceRef: string, permit: ExecutionPermit) => Promise<{
  workspaceRef: string;
  resourceId: string;
  projectResourceId: string;
  projectId: string;
  runId: string;
  attemptId: string;
  baseCommit: string;
  root: string;
  gitDirectory: string;
  commonDirectory: string;
  identity: {
    root: string;
    gitDirectory: string;
    commonDirectory: string;
    rootDevice: string;
    rootFileId: string;
    gitDevice: string;
    gitFileId: string;
  };
}>;
//#endregion
//#region src/runtime-lifecycle.d.ts
/** Local-only deployment composition. Physical paths stay in trusted backends. */
declare function createLocalManagedRuntimeLifecycle(options: {
  mode: 'local-development';
  allocator: LocalManagedWorkspaces;
  archives: LocalSourceArchives;
}): {
  config: Readonly<{
    schemaVersion: "devmesh.managed-runtime.v1";
    runnerId: string;
  }>;
  prepare(host: Readonly<ExecutionHostView>, signal: AbortSignal): Promise<{
    schemaVersion: string;
    workspaceRef: string;
    allocationOperationId: string;
    baseCommit: string;
    manifestSha256: string;
  }>;
  retain(host: Readonly<ExecutionHostView>, result: RuntimeWorkspaceResult, signal: AbortSignal): Promise<void>;
  reconcile(host: Readonly<ExecutionHostView>, result: RuntimeWorkspaceResult, signal: AbortSignal): Promise<void>;
};
//#endregion
//#region src/release-export-sources.d.ts
/** Read immutable accepted source objects; never enter a live workspace. */
declare class LocalReleaseExportSources {
  readonly root: string;
  constructor(controlDataRoot: string);
  read(context: ReleaseExportContext, signal: AbortSignal): Promise<{
    path: string;
    bytes: Buffer<ArrayBufferLike>;
    mode: "100644" | "100755";
  }[]>;
}
//#endregion
export { type AllocationFence, type AllocationFencer, type CandidateConflictContext, type CandidateMerge, type CapturedWorkspaceMaterials, ControlledGit, type GitIdentity, type GitRefUpdate, LocalCandidateConflicts, type LocalCandidateIntegrationOptions, LocalCandidateIntegrations, LocalManagedWorkspaces, LocalReleaseExportSources, type LocalRunnerFencerOptions, LocalRunnerWorkspaceFencer, type LocalSourceArchiveOptions, LocalSourceArchives, type LocalWorkspaceOptions, type LocalWorkspacePreservationOptions, LocalWorkspacePreservations, LocalWorkspaceReclamations, type PreservedWorkspaceLease, type SourceEntry, type SourceManifest, type TemplateBasis, WorkspaceError, type WorkspaceMaterialEntry, type WorkspaceMaterialSnapshot, captureWorkspaceMaterials, createLocalManagedBindingResolver, createLocalManagedRunnerAuthority, createLocalManagedRuntimeLifecycle, createLocalRepoAcquire, createLocalWorkspaceCleanupAuthority, verifyWorkspaceMaterials, verifyWorkspaceRemnants };
//# sourceMappingURL=index.d.mts.map