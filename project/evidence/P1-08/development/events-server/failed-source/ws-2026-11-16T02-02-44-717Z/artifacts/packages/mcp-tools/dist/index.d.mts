import { z } from "zod";
import { ExecutionPermit, PipelineDefinition, executionPermit } from "@devmesh/contracts";
import { PipelineDispatch, SqliteStorage } from "@devmesh/storage-sqlite";
import { RunnerClient } from "@devmesh/runner";
import { LocalContentStore } from "@devmesh/blob-store";
import { AddressInfo } from "node:net";
import { RuntimeTool } from "@devmesh/agent-runtime";

//#region src/protocol.d.ts
declare class ToolError extends Error {
  readonly code: string;
  readonly outcome: 'not-sent' | 'known' | 'unknown';
  constructor(code: string, outcome?: 'not-sent' | 'known' | 'unknown');
}
type ToolAction = 'read' | 'write' | 'stop';
interface ToolAuthority {
  authorize(controllerId: string, tool: string, permit: z.output<typeof executionPermit>, action: ToolAction): Promise<void>;
}
interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodObject;
  action: ToolAction;
  effectClass: 'READ' | 'IDEMPOTENT_WRITE' | 'NONIDEMPOTENT_WRITE';
  execute(input: {
    controllerId: string;
    operationId: string;
    permit: z.output<typeof executionPermit>;
    args: Record<string, unknown>;
    signal: AbortSignal;
  }): Promise<unknown>;
}
declare const toolEnvelope: (schema: z.ZodObject) => z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  permit: z.ZodDiscriminatedUnion<[z.ZodObject<{
    ownerKind: z.ZodLiteral<"workflowAttempt">;
    runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
    runEpoch: z.ZodNumber;
    workId: z.core.$ZodBranded<z.ZodString, "work", "out">;
    workEpoch: z.ZodNumber;
    attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
    resources: z.ZodArray<z.ZodObject<{
      resourceId: z.ZodString;
      access: z.ZodEnum<{
        read: "read";
        write: "write";
      }>;
      kind: z.ZodEnum<{
        dataset: "dataset";
        snapshot: "snapshot";
        workspace: "workspace";
        projectRepository: "projectRepository";
      }>;
    }, z.core.$strict>>;
    schemaVersion: z.ZodLiteral<"devmesh.permit.v1">;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    notBefore: z.ZodISODateTime;
    expiresAt: z.ZodISODateTime;
  }, z.core.$strict>, z.ZodObject<{
    ownerKind: z.ZodLiteral<"invocationAttempt">;
    invocationId: z.core.$ZodBranded<z.ZodString, "invocation", "out">;
    invocationEpoch: z.ZodNumber;
    invocationAttemptId: z.core.$ZodBranded<z.ZodString, "iattempt", "out">;
    resources: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
      kind: z.ZodLiteral<"snapshot">;
      resourceId: z.ZodString;
      access: z.ZodLiteral<"read">;
    }, z.core.$strict>, z.ZodObject<{
      resourceId: z.ZodString;
      access: z.ZodEnum<{
        read: "read";
        write: "write";
      }>;
      kind: z.ZodLiteral<"workspace">;
    }, z.core.$strict>], "kind">>;
    schemaVersion: z.ZodLiteral<"devmesh.permit.v1">;
    grantId: z.core.$ZodBranded<z.ZodString, "grant", "out">;
    activationId: z.core.$ZodBranded<z.ZodString, "activation", "out">;
    notBefore: z.ZodISODateTime;
    expiresAt: z.ZodISODateTime;
  }, z.core.$strict>], "ownerKind">;
  args: z.ZodObject<z.core.$ZodLooseShape, z.core.$strip>;
}, z.core.$strict>;
declare const toolResult: z.ZodDiscriminatedUnion<[z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.mcp-tool-result.v1">;
  source: z.ZodLiteral<"mcp">;
  tool: z.ZodString;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  state: z.ZodLiteral<"SUCCEEDED">;
  value: z.ZodJSONSchema;
}, z.core.$strict>, z.ZodObject<{
  schemaVersion: z.ZodLiteral<"devmesh.mcp-tool-result.v1">;
  source: z.ZodLiteral<"mcp">;
  tool: z.ZodString;
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
  state: z.ZodLiteral<"FAILED">;
  error: z.ZodObject<{
    code: z.ZodString;
    outcome: z.ZodEnum<{
      unknown: "unknown";
      "not-sent": "not-sent";
      known: "known";
    }>;
  }, z.core.$strict>;
}, z.core.$strict>], "state">;
//#endregion
//#region src/server.d.ts
interface McpServiceOptions {
  serviceId: string;
  version: string;
  host?: '127.0.0.1' | '::1';
  port?: number;
  identities: {
    controllerId: string;
    credentialRef: string;
    allowedTools: readonly string[];
  }[];
  credentials: (ref: string) => Promise<string | undefined>;
  authority: ToolAuthority;
  tools: readonly ToolDefinition[];
}
declare function serveMcp(options: McpServiceOptions): Promise<{
  address: AddressInfo;
  endpoint: string;
  close(): Promise<void>;
}>;
//#endregion
//#region src/client.d.ts
interface ConnectionSnapshot {
  endpointId: string;
  endpoint: string;
  requestTimeoutMs: number;
  protocolVersion: string;
  server: Record<string, unknown>;
  capabilities: Record<string, unknown>;
  tools: {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
    annotations?: Record<string, unknown>;
  }[];
  sha256: string;
}
interface McpClientOptions {
  endpointId: string;
  endpoint: string;
  credentialRef: string;
  credentials: (ref: string) => Promise<string | undefined>;
  timeoutMs?: number;
  expectedSnapshotHash?: string;
}
declare class McpToolClient {
  #private;
  readonly options: McpClientOptions;
  readonly endpoint: URL;
  readonly timeoutMs: number;
  constructor(options: McpClientOptions);
  get snapshot(): ConnectionSnapshot;
  connect(): Promise<ConnectionSnapshot>;
  private connectAttempt;
  call(name: string, operationId: string, permit: z.output<typeof executionPermit>, args: unknown, signal?: AbortSignal): Promise<z.core.util.JSONType>;
  close(): Promise<void>;
}
//#endregion
//#region src/repo.d.ts
declare const snapshotSchema: z.ZodObject<{
  snapshotRef: z.ZodString;
  resourceId: z.ZodString;
  root: z.ZodString;
  files: z.ZodArray<z.ZodObject<{
    path: z.ZodString;
    sha256: z.ZodString;
    byteSize: z.ZodNumber;
  }, z.core.$strict>>;
}, z.core.$strict>;
type RepoSnapshot = z.output<typeof snapshotSchema>;
declare const repoListArgs: z.ZodObject<{
  snapshotRef: z.ZodString;
  prefix: z.ZodDefault<z.ZodString>;
  limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
declare const repoReadArgs: z.ZodObject<{
  snapshotRef: z.ZodString;
  path: z.ZodString;
}, z.core.$strict>;
declare function repoTools(input: readonly RepoSnapshot[]): ToolDefinition[];
//#endregion
//#region src/tests.d.ts
declare const checkSchema: z.ZodObject<{
  checkId: z.ZodString;
  imageDigest: z.ZodString;
  commandSpec: z.ZodObject<{
    kind: z.ZodEnum<{
      preview: "preview";
      install: "install";
      build: "build";
      unit: "unit";
      e2e: "e2e";
    }>;
  }, z.core.$strict>;
  resourceLimits: z.ZodObject<{
    cpu: z.ZodNumber;
    memoryMiB: z.ZodNumber;
    pids: z.ZodNumber;
    temporaryMiB: z.ZodNumber;
    timeoutMs: z.ZodNumber;
  }, z.core.$strict>;
  networkPolicyRef: z.ZodLiteral<"none">;
  outputSpec: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
type CheckDefinition = z.output<typeof checkSchema>;
declare const testsStartArgs: z.ZodObject<{
  checkId: z.ZodString;
  workspaceRef: z.ZodString;
}, z.core.$strict>;
declare const testsJobArgs: z.ZodObject<{
  jobId: z.core.$ZodBranded<z.ZodString, "job", "out">;
}, z.core.$strict>;
declare const testsOperationArgs: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
}, z.core.$strict>;
declare function testTools(runner: RunnerClient, definitions: readonly CheckDefinition[]): ToolDefinition[];
//#endregion
//#region src/bridge.d.ts
declare function runtimeMcpTools(client: McpToolClient, contracts: readonly Pick<ToolDefinition, 'name' | 'description' | 'schema' | 'effectClass'>[]): RuntimeTool[];
//#endregion
//#region src/docs.d.ts
declare const binding: z.ZodObject<{
  documentRef: z.ZodString;
  version: z.ZodString;
  resourceId: z.ZodString;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  principalId: z.ZodString;
  reference: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"artifact">;
    artifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
  }, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"attachment">;
    attachmentId: z.core.$ZodBranded<z.ZodString, "attachment", "out">;
  }, z.core.$strict>], "kind">;
  sha256: z.ZodString;
  byteSize: z.ZodNumber;
}, z.core.$strict>;
type DocumentBinding = z.output<typeof binding>;
declare const docsReadArgs: z.ZodObject<{
  documentRef: z.ZodString;
  version: z.ZodString;
  startOffset: z.ZodDefault<z.ZodNumber>;
  limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
declare const docsSearchArgs: z.ZodObject<{
  documents: z.ZodArray<z.ZodObject<{
    documentRef: z.ZodString;
    version: z.ZodString;
  }, z.core.$strict>>;
  query: z.ZodString;
  limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
declare function docsTools(content: LocalContentStore, input: readonly DocumentBinding[]): ToolDefinition[];
//#endregion
//#region src/issues.d.ts
declare const issuesGetArgs: z.ZodObject<{
  issueId: z.ZodString;
  afterRevision: z.ZodDefault<z.ZodNumber>;
  limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
declare const issuesOperationArgs: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
}, z.core.$strict>;
declare function issueTools(storage: SqliteStorage): ToolDefinition[];
//#endregion
//#region src/authority.d.ts
/** Deployment-owned controllers; model arguments cannot add a controller or a tool. */
declare function workflowToolAuthority(storage: SqliteStorage, controllers: ReadonlyMap<string, ReadonlySet<string>>): ToolAuthority;
//#endregion
//#region src/pipeline.d.ts
declare const pipelineStartArgs: z.ZodObject<{
  definitionId: z.ZodString;
  workspaceRef: z.ZodString;
}, z.core.$strict>;
declare const pipelineGetArgs: z.ZodObject<{
  pipelineId: z.ZodString;
}, z.core.$strict>;
declare const pipelineOperationArgs: z.ZodObject<{
  operationId: z.core.$ZodBranded<z.ZodString, "op", "out">;
}, z.core.$strict>;
declare const pipelineLogsArgs: z.ZodObject<{
  pipelineId: z.ZodString;
  ordinal: z.ZodNumber;
  offset: z.ZodDefault<z.ZodNumber>;
  limit: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
declare function pipelineTools(storage: SqliteStorage, runner: RunnerClient, input: readonly PipelineDefinition[]): ToolDefinition[];
/** Explicitly started coordinator; only this service writes stage/Runner facts. */
declare class PipelineCoordinator {
  #private;
  readonly storage: SqliteStorage;
  readonly runner: RunnerClient;
  lastError: string | null;
  constructor(storage: SqliteStorage, runner: RunnerClient);
  private record;
  process(item: PipelineDispatch): Promise<void>;
  tick(): Promise<void>;
  start(): void;
  stop(): Promise<void>;
}
//#endregion
//#region src/repo-git.d.ts
declare const bindingSchema: z.ZodObject<{
  workspaceRef: z.ZodString;
  resourceId: z.ZodString;
  projectResourceId: z.ZodString;
  projectId: z.core.$ZodBranded<z.ZodString, "prj", "out">;
  runId: z.core.$ZodBranded<z.ZodString, "run", "out">;
  attemptId: z.core.$ZodBranded<z.ZodString, "attempt", "out">;
  baseCommit: z.ZodString;
  root: z.ZodString;
  gitDirectory: z.ZodString;
  commonDirectory: z.ZodString;
  identity: z.ZodOptional<z.ZodObject<{
    root: z.ZodString;
    gitDirectory: z.ZodString;
    commonDirectory: z.ZodString;
    rootDevice: z.ZodString;
    rootFileId: z.ZodString;
    gitDevice: z.ZodString;
    gitFileId: z.ZodString;
  }, z.core.$strict>>;
}, z.core.$strict>;
type RepoWorkspaceBinding = z.output<typeof bindingSchema>;
interface RepoWorkspaceLease {
  release(): Promise<void>;
}
/** The allocator must fence Runner/editors as well as other Git writers. */
interface RepoWorkspaceAccess {
  operationId: string;
  permit: ExecutionPermit;
  purpose: 'read' | 'write' | 'reconcile';
}
interface RepoGitOptions {
  storage: SqliteStorage;
  bindings: readonly RepoWorkspaceBinding[];
  resolveBinding?: (workspaceRef: string, permit: ExecutionPermit) => Promise<RepoWorkspaceBinding>;
  scratchRoot: string;
  acquire: (binding: RepoWorkspaceBinding, signal: AbortSignal, access: RepoWorkspaceAccess) => Promise<RepoWorkspaceLease>;
  authorizeIntegration?: (binding: RepoWorkspaceBinding, commit: string, signal: AbortSignal) => Promise<void>;
}
declare function repoGitTools(options: RepoGitOptions): ToolDefinition[];
//#endregion
//#region src/composition.d.ts
type McpServiceKind = 'repo' | 'docs' | 'tests' | 'issues' | 'pipeline';
interface WorkflowMcpIdentity {
  serviceId: string;
  controllerId: string;
  credentialRef: string;
  timeoutMs?: number;
}
interface WorkflowMcpOptions {
  identities: Partial<Record<McpServiceKind, WorkflowMcpIdentity>>;
  credentials: (ref: string) => Promise<string | undefined>;
  repo?: {
    snapshots: readonly RepoSnapshot[];
    git?: Omit<RepoGitOptions, 'storage'>;
  };
  docs?: readonly DocumentBinding[];
  tests?: {
    runner: RunnerClient;
    checks: readonly CheckDefinition[];
  };
  issues?: boolean;
  pipeline?: {
    runner: RunnerClient;
    definitions: readonly PipelineDefinition[];
  };
}
/** Explicit composition: no backend, identity or credential is inferred from a model. */
declare function startWorkflowMcpServices(storage: SqliteStorage, content: LocalContentStore, options: WorkflowMcpOptions): Promise<{
  tools: readonly RuntimeTool[];
  connections: readonly ConnectionSnapshot[];
  stopAdmission: () => void;
  close: () => Promise<void>;
  coordinator: PipelineCoordinator | undefined;
}>;
type WorkflowMcpServices = Awaited<ReturnType<typeof startWorkflowMcpServices>>;
//#endregion
export { type CheckDefinition, type ConnectionSnapshot, type DocumentBinding, type McpClientOptions, type McpServiceKind, type McpServiceOptions, McpToolClient, PipelineCoordinator, type RepoGitOptions, type RepoSnapshot, type RepoWorkspaceAccess, type RepoWorkspaceBinding, type RepoWorkspaceLease, type ToolAction, type ToolAuthority, type ToolDefinition, ToolError, type WorkflowMcpIdentity, type WorkflowMcpOptions, type WorkflowMcpServices, docsReadArgs, docsSearchArgs, docsTools, issueTools, issuesGetArgs, issuesOperationArgs, pipelineGetArgs, pipelineLogsArgs, pipelineOperationArgs, pipelineStartArgs, pipelineTools, repoGitTools, repoListArgs, repoReadArgs, repoTools, runtimeMcpTools, serveMcp, startWorkflowMcpServices, testTools, testsJobArgs, testsOperationArgs, testsStartArgs, toolEnvelope, toolResult, workflowToolAuthority };
//# sourceMappingURL=index.d.mts.map