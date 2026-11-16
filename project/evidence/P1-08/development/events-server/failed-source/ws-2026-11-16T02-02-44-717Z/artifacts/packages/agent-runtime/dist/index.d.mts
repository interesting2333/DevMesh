import { RuntimeConfig, parseRuntimeConfig } from "./config.mjs";
import { z } from "zod";
import { ExecutionPermit } from "@devmesh/contracts";
import { ExecutionHostView, PreparationClaim, PreparationJob, RuntimeToolView, RuntimeWorkspaceResult, SqliteStorage } from "@devmesh/storage-sqlite";
import { LocalContentStore, SessionStore } from "@devmesh/blob-store";
import { AgentRegistry, CredentialResolver } from "@devmesh/a2a-adapter";

//#region src/provider.d.ts
declare class ModelError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly outcome: 'not-sent' | 'known-failed' | 'unknown';
  constructor(code: string, retryable: boolean, outcome: 'not-sent' | 'known-failed' | 'unknown', message?: string);
}
declare const capabilitiesSchema: z.ZodObject<{
  revision: z.ZodString;
  contextTokens: z.ZodNumber;
  maxOutputTokens: z.ZodNumber;
  toolCalls: z.ZodBoolean;
  structuredOutput: z.ZodEnum<{
    "json-object": "json-object";
    "text-json": "text-json";
  }>;
  tokenCounting: z.ZodLiteral<"utf8-conservative-v1">;
  reasoningMode: z.ZodLiteral<"disabled">;
  verification: z.ZodEnum<{
    DECLARED: "DECLARED";
    VERIFIED: "VERIFIED";
  }>;
  evidenceRef: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
declare const providerConfigSchema: z.ZodObject<{
  providerId: z.ZodString;
  endpoint: z.ZodURL;
  model: z.ZodString;
  credentialRef: z.ZodString;
  capabilities: z.ZodObject<{
    revision: z.ZodString;
    contextTokens: z.ZodNumber;
    maxOutputTokens: z.ZodNumber;
    toolCalls: z.ZodBoolean;
    structuredOutput: z.ZodEnum<{
      "json-object": "json-object";
      "text-json": "text-json";
    }>;
    tokenCounting: z.ZodLiteral<"utf8-conservative-v1">;
    reasoningMode: z.ZodLiteral<"disabled">;
    verification: z.ZodEnum<{
      DECLARED: "DECLARED";
      VERIFIED: "VERIFIED";
    }>;
    evidenceRef: z.ZodOptional<z.ZodString>;
  }, z.core.$strict>;
  connectTimeoutMs: z.ZodDefault<z.ZodNumber>;
  requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
  maximumResponseBytes: z.ZodDefault<z.ZodNumber>;
}, z.core.$strict>;
type ProviderConfig = z.input<typeof providerConfigSchema>;
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}
interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}
interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
interface ModelRequest {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  maxOutputTokens: number;
  jsonOutput: boolean;
}
interface ModelResponse {
  content: string;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'insufficient_system_resource';
  requestId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    source: 'provider' | 'estimated';
  };
  model: string;
  cost: null;
}
interface ModelProvider {
  readonly config: z.output<typeof providerConfigSchema>;
  complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse>;
}
declare function estimateTokens(value: unknown): number;
declare function checkModelRequest(config: z.output<typeof providerConfigSchema>, r: ModelRequest): void;
declare class DeepSeekProvider implements ModelProvider {
  readonly credentials: CredentialResolver;
  readonly config: z.output<typeof providerConfigSchema>;
  constructor(config: ProviderConfig, credentials: CredentialResolver);
  complete(request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse>;
}
//#endregion
//#region src/roles.d.ts
declare const roleSchemas: Readonly<Record<string, string>>;
declare const roleConfigSchema: z.ZodObject<{
  role: z.ZodEnum<{
    product: "product";
    architect: "architect";
    developer: "developer";
    tester: "tester";
  }>;
  revision: z.ZodString;
  provider: z.ZodString;
  model: z.ZodString;
  promptArtifactId: z.core.$ZodBranded<z.ZodString, "artifact", "out">;
  outputSchemaId: z.ZodString;
  allowedTools: z.ZodArray<z.ZodString>;
  maxSteps: z.ZodNumber;
  contextLimitTokens: z.ZodNumber;
  outputReserveTokens: z.ZodNumber;
  requestTimeoutMs: z.ZodNumber;
  maxReadOnlyRetries: z.ZodNumber;
}, z.core.$strict>;
type RoleConfig = z.output<typeof roleConfigSchema>;
declare class RoleRegistry {
  #private;
  constructor(providers: ModelProvider[]);
  resolve(input: unknown): {
    role: RoleConfig;
    provider: ModelProvider;
  };
}
//#endregion
//#region src/runtime.d.ts
type ExecutionClaim = {
  endpointId: string;
  taskId: string;
  workerId: string;
  claimToken: string;
};
type ToolResult = {
  state: 'SUCCEEDED' | 'FAILED';
  value: unknown;
} | {
  state: 'OUTCOME_UNKNOWN';
};
interface RuntimeTool {
  name: string;
  description: string;
  schema: z.ZodType;
  effectClass: 'READ' | 'IDEMPOTENT_WRITE' | 'NONIDEMPOTENT_WRITE';
  connection?: Record<string, unknown>;
  execute(operationId: string, args: unknown, host: Readonly<ExecutionHostView>, signal: AbortSignal): Promise<ToolResult>;
  query(operationId: string, host: Readonly<ExecutionHostView>, originalArgs?: unknown): Promise<ToolResult>;
}
type RuntimeOutcome = {
  state: 'completed';
  candidate: {
    artifactId: string;
    sha256: string;
    schemaId: string;
  };
  sessionId: string;
} | {
  state: 'failed' | 'reconcile';
  code: string;
};
/** Trusted application adapter, never supplied by a model or protocol request. */
interface RuntimeWorkspaceLifecycle {
  readonly config: Readonly<{
    schemaVersion: 'devmesh.managed-runtime.v1';
    runnerId: string;
  }>;
  prepare(host: Readonly<ExecutionHostView>, signal: AbortSignal): Promise<Record<string, unknown>>;
  retain(host: Readonly<ExecutionHostView>, result: RuntimeWorkspaceResult, signal: AbortSignal): Promise<void>;
  reconcile(host: Readonly<ExecutionHostView>, result: RuntimeWorkspaceResult, signal: AbortSignal): Promise<void>;
}
declare class AgentRuntime {
  #private;
  readonly storage: SqliteStorage;
  readonly content: LocalContentStore;
  readonly tokenLimit: number;
  readonly workspace?: RuntimeWorkspaceLifecycle | undefined;
  readonly sessions: SessionStore;
  readonly roles: RoleRegistry;
  constructor(storage: SqliteStorage, content: LocalContentStore, providers: ModelProvider[], tools?: RuntimeTool[], tokenLimit?: number, workspace?: RuntimeWorkspaceLifecycle | undefined);
  execute(claim: ExecutionClaim, signal?: AbortSignal): Promise<RuntimeOutcome>;
  /** Original result recovery grants no model, tool, checkout or transfer admission. */
  reconcileWorkspaceResult(claim: ExecutionClaim, signal?: AbortSignal): Promise<RuntimeOutcome>;
  private saveToolResult;
  /** Queries an existing operation only; no admission, replay or activation restart. */
  reconcileTool(host: ExecutionHostView, stepNo: number, toolCallId: string, toolName: string): Promise<RuntimeToolView>;
}
//#endregion
//#region src/consumer.d.ts
/** Optional bounded consumer. Construction alone never starts model calls. */
declare class RuntimeConsumer {
  #private;
  readonly storage: SqliteStorage;
  readonly runtime: AgentRuntime;
  readonly endpointIds: readonly string[];
  readonly workerId: string;
  lastError: string | null;
  constructor(storage: SqliteStorage, runtime: AgentRuntime, endpointIds: readonly string[], workerId: string);
  start(): Promise<void>;
  private poll;
  private consume;
  stop(): Promise<void>;
}
//#endregion
//#region src/preparation.d.ts
type PreparationRole = 'product' | 'architect';
interface PreparationOptions {
  callerId: string;
  workerId: string;
  tokenLimit: number;
  maxInputBytes: number;
  maxOutputTokens: number;
  providers: Readonly<Partial<Record<PreparationRole, ModelProvider>>>;
  bootstrap?: {
    repositoryRoot: string;
    paths: readonly string[];
  };
  available?: (provider: ModelProvider) => Promise<boolean>;
}
declare function readPreparationGitSource(root: string, commit: string, path: string, maximumBytes: number, signal: AbortSignal): Promise<NonSharedBuffer>;
declare class PreparationRuntime {
  #private;
  readonly content: LocalContentStore;
  readonly registry: AgentRegistry;
  readonly credentials: CredentialResolver;
  readonly options: PreparationOptions;
  constructor(content: LocalContentStore, registry: AgentRegistry, credentials: CredentialResolver, options: PreparationOptions);
  get storage(): import("@devmesh/storage-sqlite").SqliteStorage;
  dispatch(job: PreparationJob, signal: AbortSignal): Promise<import("@devmesh/storage-sqlite").PreparationTask | null>;
  execute(claim: PreparationClaim, signal: AbortSignal): Promise<{
    artifactId: string;
    sha256: string;
    requirementRevision?: number;
    planRevision?: number;
  } | {
    errorCode: string;
  }>;
}
declare class PreparationConsumer {
  #private;
  readonly runtime: PreparationRuntime;
  readonly endpointIds: readonly string[];
  constructor(runtime: PreparationRuntime, endpointIds: readonly string[]);
  lastError: string | null;
  start(): Promise<void>;
  private poll;
  stop(): Promise<void>;
}
//#endregion
//#region src/lease.d.ts
/** A claimed, live Host can renew the same grant; expiry cannot be revived. */
declare class ExecutionGrantLease {
  #private;
  readonly storage: SqliteStorage;
  readonly claim: ExecutionClaim;
  readonly update: (permit: ExecutionPermit) => void;
  get signal(): AbortSignal;
  constructor(storage: SqliteStorage, claim: ExecutionClaim, update: (permit: ExecutionPermit) => void);
  start(): Promise<void>;
  private renew;
  stop(): Promise<void>;
}
//#endregion
export { AgentRuntime, type ChatMessage, DeepSeekProvider, type ExecutionClaim, ExecutionGrantLease, ModelError, type ModelProvider, type ModelRequest, type ModelResponse, PreparationConsumer, type PreparationOptions, PreparationRuntime, type ProviderConfig, type RoleConfig, RoleRegistry, type RuntimeConfig, RuntimeConsumer, type RuntimeOutcome, type RuntimeTool, type RuntimeWorkspaceLifecycle, type ToolCall, type ToolDefinition, type ToolResult, capabilitiesSchema, checkModelRequest, estimateTokens, parseRuntimeConfig, providerConfigSchema, readPreparationGitSource, roleConfigSchema, roleSchemas };
//# sourceMappingURL=index.d.mts.map