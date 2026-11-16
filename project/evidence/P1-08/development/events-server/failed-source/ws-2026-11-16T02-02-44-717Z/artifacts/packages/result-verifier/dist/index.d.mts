import { QualityEvaluation, QualityPolicy, QualityReport, QualitySourceScope, previewImageLimits, qualityBranch, qualityLocation } from "@devmesh/contracts";
import { QualityStage, QualityVerification, ReleaseExportContext, ReleaseExportJob, Request, Results, SourceManifest, SqliteStorage, VerifiedRepair, WorkVerification } from "@devmesh/storage-sqlite";
import { LocalContentStore } from "@devmesh/blob-store";
import { RunnerClient } from "@devmesh/runner";

//#region src/json.d.ts
declare class VerificationError extends Error {
  readonly code: string;
  constructor(code: string);
}
declare function parseReportJson(bytes: Uint8Array): unknown;
//#endregion
//#region src/source.d.ts
declare const sha256: (value: string | Uint8Array) => string;
declare function canonical(value: unknown): string;
declare function qualityPolicyHash(value: unknown): string;
declare function normalizeReportPath(raw: unknown, prefixes: readonly string[]): string;
declare function assertQualityScope(raw: unknown, policy: QualityPolicy): QualitySourceScope;
declare function freezeQualitySourceScope(input: {
  policy: unknown;
  targetCommit: string;
  gitManifest: QualitySourceScope['gitManifest'];
  businessFiles: QualitySourceScope['businessFiles'];
}): QualitySourceScope;
//#endregion
//#region src/reports.d.ts
type SourceFile = QualitySourceScope['gitManifest'][number];
type FileCoverage = {
  path: string;
  statements: Map<string, {
    loc: typeof qualityLocation._output;
    hit: boolean;
  }>;
  branches: Map<string, {
    branch: typeof qualityBranch._output;
    hits: boolean[];
  }>;
};
declare function parseIstanbulReport(bytes: Uint8Array, prefixes: readonly string[], sources: readonly SourceFile[]): Map<string, FileCoverage>;
type ParsedTests = {
  cases: Map<string, 'PASSED' | 'FAILED' | 'SKIPPED'>;
  failedSuites: number;
  runFailed: boolean;
};
declare function parseVitestReport(bytes: Uint8Array, prefixes: readonly string[]): ParsedTests;
//#endregion
//#region src/evaluate.d.ts
interface QualityReportBytes {
  report: QualityReport;
  bytes: Uint8Array;
}
declare function evaluateQuality(input: {
  policy: unknown;
  scope: unknown;
  executions: unknown[];
  reports: QualityReportBytes[];
}): QualityEvaluation;
//#endregion
//#region src/collector.d.ts
/** Deployment supplied trusted instrumentation; never an Agent/MCP report reader. */
interface QualitySourceProvider {
  readonly providerId: string;
  readonly toolchainHash: string;
  prepare(input: {
    verification: QualityVerification;
    policy: QualityPolicy;
    manifest: SourceManifest;
  }): Promise<QualitySourceScope>;
}
type Subject$1 = {
  principalId: string;
  operationId: string;
};
type CollectionResult = {
  state: 'PENDING';
  verification: QualityVerification;
  codes: string[];
} | {
  state: 'EVALUATED';
  verification: QualityVerification;
};
/** Explicit service. It has no start, resend, renew, stop or shell execution path. */
declare class QualityCollector {
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  readonly runner: Pick<RunnerClient, 'get' | 'byOperation' | 'output'>;
  readonly sourceProvider?: QualitySourceProvider | undefined;
  constructor(storage: SqliteStorage, content: LocalContentStore, runner: Pick<RunnerClient, 'get' | 'byOperation' | 'output'>, sourceProvider?: QualitySourceProvider | undefined);
  private materials;
  private put;
  private read;
  prepare(input: Request<'beginQualityVerification'>): Promise<QualityVerification>;
  bind(subject: Subject$1, binding: {
    producerId: string;
    pipelineId: string;
    ordinal: number;
  }): Promise<QualityStage>;
  /** Publish original report/result references after reading their retained bytes.
   * This private owner service never uploads Agent-supplied report identities. */
  references(subject: Subject$1): Promise<import("@devmesh/storage-sqlite").QualityArtifactRef[]>;
  collect(subject: Subject$1): Promise<CollectionResult>;
}
//#endregion
//#region src/work.d.ts
type Subject = {
  principalId: string;
  operationId: string;
  runId: string;
  attemptId: string;
  qualityOperationId?: string | null;
};
interface WorkVerificationResult {
  verification: WorkVerification;
  completion: Results['recordVerifiedWork'] | null;
}
/** Reads original artifacts and publishes one immutable assessment before applying it.
 * No model, Job dispatch, command, or caller-supplied success decision is accepted. */
declare class WorkVerifier {
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  constructor(storage: SqliteStorage, content: LocalContentStore);
  private completion;
  private originalContent;
  verify(input: Subject): Promise<WorkVerificationResult>;
}
//#endregion
//#region src/repair.d.ts
/** Proposes a new immutable plan. Execution still waits for explicit confirmation. */
declare class RepairPlanner {
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  constructor(storage: SqliteStorage, content: LocalContentStore);
  prepare(input: Request<'prepareVerifiedRepair'>): Promise<VerifiedRepair>;
  publish(principalId: string, operationId: string): Promise<Results['publishVerifiedRepair']>;
}
//#endregion
//#region src/preview-image.d.ts
interface PreviewImageInput {
  targetCommit: string;
  buildArtifactHash: string;
  manifestBytes: Uint8Array;
  /** Exact raw Runner output blobs keyed by sha256: identity. */
  blobs: ReadonlyMap<string, Uint8Array>;
  expectedDigest?: string;
}
interface PreviewImageIdentity {
  schemaVersion: 'devmesh.preview-image-identity.v1';
  imageDigest: string;
  configDigest: string;
  targetCommit: string;
  buildArtifactHash: string;
  os: 'linux';
  architecture: 'amd64' | 'arm64';
  layers: {
    digest: string;
    diffId: string;
    byteSize: number;
    expandedByteSize: number;
  }[];
}
/** Content identity only: no extraction, process, filesystem, network or tag
 * resolution. A separate original approved build Job must prove provenance. */
declare function verifyPreviewImage(input: PreviewImageInput): PreviewImageIdentity;
//#endregion
//#region src/delivery.d.ts
/** Collects only the approved original Job's fixed outputs. No execution path. */
declare class DeliveryCollector {
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  readonly runner?: Pick<RunnerClient, "get" | "output"> | undefined;
  constructor(storage: SqliteStorage, content: LocalContentStore, runner?: Pick<RunnerClient, "get" | "output"> | undefined);
  collect(input: Request<'beginReleaseDelivery'>): Promise<import("@devmesh/storage-sqlite").ReleaseDelivery>;
  private check;
}
//#endregion
//#region src/freeze.d.ts
type Input = Omit<Request<'freezeReleaseCandidate'>, 'basisHash' | 'contentHashes'>;
/** Actual bytes are read before a basis-checked Worker transaction. No execution. */
declare class CandidateFreezer {
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  constructor(storage: SqliteStorage, content: LocalContentStore);
  freeze(input: Input): Promise<import("@devmesh/storage-sqlite").ReleaseCandidateRevision>;
}
//#endregion
//#region src/release-export.d.ts
interface ReleaseExportSources {
  read(context: ReleaseExportContext, signal: AbortSignal): Promise<{
    path: string;
    bytes: Uint8Array;
    mode: '100644' | '100755';
  }[]>;
}
declare class ReleaseExporter {
  #private;
  readonly content: LocalContentStore;
  readonly sources: ReleaseExportSources;
  constructor(content: LocalContentStore, sources: ReleaseExportSources);
  advance(principalId: string, exportId: string, signal?: AbortSignal): Promise<ReleaseExportJob>;
  private pack;
}
//#endregion
//#region src/export-zip.d.ts
interface ZipFile {
  path: string;
  bytes: Uint8Array;
  mode?: '100644' | '100755';
}
declare const exportLimits: Readonly<{
  entries: 20000;
  entryBytes: number;
  archiveBytes: number;
}>;
declare function exportPath(path: string): string;
/** Deterministic ZIP32 STORE: no extraction, compression, symlinks or execution. */
declare function buildExportZip(input: readonly ZipFile[]): Buffer;
//#endregion
export { CandidateFreezer, type CollectionResult, DeliveryCollector, type PreviewImageIdentity, type PreviewImageInput, QualityCollector, type QualityReportBytes, type QualitySourceProvider, type ReleaseExportSources, ReleaseExporter, RepairPlanner, VerificationError, type WorkVerificationResult, WorkVerifier, assertQualityScope, buildExportZip, canonical, evaluateQuality, exportLimits, exportPath, freezeQualitySourceScope, normalizeReportPath, parseIstanbulReport, parseReportJson, parseVitestReport, previewImageLimits, qualityPolicyHash, sha256, verifyPreviewImage };
//# sourceMappingURL=index.d.mts.map